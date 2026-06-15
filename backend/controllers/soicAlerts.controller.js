const PDFDocument = require("pdfkit");
const ExcelJS = require("exceljs");
const { buildAlertReportWorkbook } = require("../services/excelAlertService");
const Alert = require("../models/Alert");
const AlertHistory = require("../models/AlertHistory");
const SiteMonitoringState = require("../models/SiteMonitoringState");
const { resolveAlert: engineResolveAlert } = require("../services/soicAlertEngine");

// --- UTILITIES ---
const calculateHistoryMetrics = (history) => {
	const total = history.length;
	let open = 0, resolved = 0;
	let yellow = 0, orange = 0, red = 0, critical = 0, offline = 0;
	let totalResolutionTime = 0;
	let resolvedCount = 0;
	let longestIncident = 0;
	let totalDaysUnderAlert = 0;
	let mostRecent = "N/A";

	if (total > 0) {
		const sorted = [...history].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
		mostRecent = new Date(sorted[0].created_at).toISOString().split("T")[0];
	}

	for (const record of history) {
		if (record.status === "RESOLVED") resolved++;
		else open++;

		const sev = record.highest_severity_reached || record.severity;
		if (sev === "YELLOW") yellow++;
		if (sev === "ORANGE") orange++;
		if (sev === "RED") red++;
		if (sev === "CRITICAL") critical++;
		if (sev === "OFFLINE") offline++;

		const daysActive = record.total_days_active || record.consecutive_days || 0;
		totalDaysUnderAlert += daysActive;
		if (daysActive > longestIncident) longestIncident = daysActive;

		if (record.status === "RESOLVED" && record.resolved_at && record.created_at) {
			const ms = new Date(record.resolved_at) - new Date(record.created_at);
			const days = ms / (1000 * 60 * 60 * 24);
			totalResolutionTime += days;
			resolvedCount++;
		}
	}

	const avgResolutionTime = resolvedCount > 0 ? (totalResolutionTime / resolvedCount).toFixed(1) : 0;
	
	const percent = (count) => total > 0 ? ((count / total) * 100).toFixed(0) : 0;

	return {
		TotalAlerts: total,
		Open: open,
		Resolved: resolved,
		SeverityBreakdown: {
			YELLOW: { count: yellow, percent: percent(yellow) },
			ORANGE: { count: orange, percent: percent(orange) },
			RED: { count: red, percent: percent(red) },
			CRITICAL: { count: critical, percent: percent(critical) },
			OFFLINE: { count: offline, percent: percent(offline) }
		},
		AverageResolutionTime: avgResolutionTime,
		LongestIncident: longestIncident,
		MostRecentIncident: mostRecent,
		TotalDaysUnderAlert: totalDaysUnderAlert
	};
};

// --- CORE HANDLERS ---
const UserData = require("../models/data");

exports.getDashboard = async (req, res) => {
	try {
		const openAlerts = await Alert.find({ status: { $ne: "RESOLVED" } }).lean();
		const states = await SiteMonitoringState.find().lean();
		const statesMap = states.reduce((acc, curr) => {
			acc[curr.user_id.toString()] = curr;
			return acc;
		}, {});

		const populatedAlerts = openAlerts.map(alert => ({
			...alert,
			performance_window: statesMap[alert.user_id.toString()]?.performance_window || []
		}));

		const active_alerts = populatedAlerts.filter(a => ["YELLOW", "ORANGE", "RED"].includes(a.severity));
		const critical_sites = populatedAlerts.filter(a => a.severity === "CRITICAL");
		const offline_sites = populatedAlerts.filter(a => a.severity === "OFFLINE");

		// Derived Active Sites
		const activeUsers = await UserData.find({ isDeleted: { $ne: true }, status: { $ne: "deleted" } }).lean();
		const active_sites = [];
		for (const user of activeUsers) {
			const hasOpenAlert = openAlerts.some(a => a.user_id.toString() === user._id.toString());
			if (!hasOpenAlert) {
				const state = statesMap[user._id.toString()];
				let latestPerfStr = "N/A";
				let statusStr = "Healthy";
				
				if (state && state.performance_window && state.performance_window.length > 0) {
					const numericPerf = state.performance_window[state.performance_window.length - 1].performance_percent;
					latestPerfStr = numericPerf.toFixed(1) + "%";
					if (numericPerf < 90) {
						statusStr = "Warning";
					}
				}
				
				active_sites.push({
					site_id: user._id.toString(),
					site_name: user.name,
					status: statusStr,
					last_evaluated_date: state && state.last_evaluated_date ? state.last_evaluated_date : "N/A",
					performance_percent: latestPerfStr
				});
			}
		}

		res.status(200).json({
			success: true,
			data: {
				metrics: {
					total_sites: activeUsers.length,
					connected_sites: activeUsers.length - offline_sites.length,
					active_sites: active_sites.length,
					offline_sites: offline_sites.length,
					active_alerts: active_alerts.length,
					critical_sites: critical_sites.length
				},
				active_sites,
				active_alerts,
				critical_sites,
				offline_sites
			}
		});
	} catch (error) {
		res.status(500).json({ success: false, message: error.message });
	}
};

exports.getResolvedAlerts = async (req, res) => {
	try {
		const resolved = await AlertHistory.find({ status: "RESOLVED" }).sort({ resolved_at: -1 }).limit(100).lean();
		res.status(200).json({ success: true, data: resolved });
	} catch (error) {
		res.status(500).json({ success: false, message: error.message });
	}
};

exports.acknowledgeAlert = async (req, res) => {
	try {
		const alert = await Alert.findById(req.params.id);
		if (!alert) return res.status(404).json({ success: false, message: "Alert not found" });
		
		alert.status = "ACKNOWLEDGED";
		await alert.save();

		res.status(200).json({ success: true, data: alert });
	} catch (error) {
		res.status(500).json({ success: false, message: error.message });
	}
};

exports.resolveAlert = async (req, res) => {
	try {
		const alert = await Alert.findById(req.params.id);
		if (!alert) return res.status(404).json({ success: false, message: "Alert not found" });

		const state = await SiteMonitoringState.findOne({ user_id: alert.user_id });
		if (!state) return res.status(404).json({ success: false, message: "State not found" });

		if (req.body.notes) alert.notes = req.body.notes;
		await engineResolveAlert(alert, state, "Operator");

		res.status(200).json({ success: true, message: "Alert resolved securely via Engine." });
	} catch (error) {
		res.status(500).json({ success: false, message: error.message });
	}
};

// --- REPORTS MODULE ---
exports.getValidSites = async (req, res) => {
	try {
		const users = await UserData.find({ isDeleted: { $ne: true }, status: { $ne: "deleted" } }, { name: 1 }).lean();
		const validNames = new Set(users.map(u => (u.name || "").trim()).filter(Boolean));
		
		const historyNames = await AlertHistory.distinct("site_name");
		for (const name of historyNames) {
			const cleanName = (name || "").trim();
			if (!cleanName) continue;
			const exists = Array.from(validNames).some(v => v.toLowerCase() === cleanName.toLowerCase());
			if (!exists) {
				validNames.add(cleanName);
			}
		}

		const sortedNames = Array.from(validNames).sort((a, b) => a.localeCompare(b));
		res.status(200).json({ success: true, data: sortedNames });
	} catch (error) {
		res.status(500).json({ success: false, message: error.message });
	}
};

exports.getSiteAlertHistory = async (req, res) => {
	try {
		const { siteName, startDate, endDate } = req.query;
		if (!siteName) return res.status(400).json({ success: false, message: "siteName is required" });

		const siteRegex = new RegExp(`^${siteName.trim()}$`, "i");
		const userRecord = await UserData.findOne({ name: siteRegex, isDeleted: { $ne: true }, status: { $ne: "deleted" } }).lean();
		let actualSiteName = null;

		if (userRecord) {
			actualSiteName = userRecord.name;
		} else {
			const historyRecord = await AlertHistory.findOne({ site_name: siteRegex }).lean();
			if (historyRecord) actualSiteName = historyRecord.site_name;
		}

		if (!actualSiteName) {
			return res.status(404).json({ success: false, message: "Site not found. Please select a valid site from the available fleet." });
		}

		let historyQuery = { site_name: actualSiteName };
		if (startDate || endDate) {
			historyQuery.created_at = {};
			if (startDate) historyQuery.created_at.$gte = new Date(startDate);
			if (endDate) historyQuery.created_at.$lte = new Date(endDate);
		}

		const history = await AlertHistory.find(historyQuery).sort({ created_at: -1 }).lean();
		const historicalMetrics = calculateHistoryMetrics(history);

		const activeAlerts = await Alert.find({ site_name: actualSiteName, status: { $in: ["OPEN", "ACKNOWLEDGED"] } }).sort({ created_at: -1 }).lean();
		
		const activeMetrics = {
			open: activeAlerts.length,
			offline: activeAlerts.filter(a => a.severity === "OFFLINE").length,
			critical: activeAlerts.filter(a => a.severity === "CRITICAL").length
		};

		res.status(200).json({
			success: true,
			data: {
				metrics: {
					historical: historicalMetrics,
					active: activeMetrics
				},
				active_incidents: activeAlerts,
				history: history
			}
		});
	} catch (error) {
		res.status(500).json({ success: false, message: error.message });
	}
};

exports.generateReportPDF = async (req, res) => {
	try {
		const { siteName, startDate, endDate } = req.query;
		if (!siteName) return res.status(400).send("siteName required");

		const siteRegex = new RegExp(`^${siteName.trim()}$`, "i");
		const userRecord = await UserData.findOne({ name: siteRegex, isDeleted: { $ne: true }, status: { $ne: "deleted" } }).lean();
		let actualSiteName = null;

		if (userRecord) {
			actualSiteName = userRecord.name;
		} else {
			const historyRecord = await AlertHistory.findOne({ site_name: siteRegex }).lean();
			if (historyRecord) actualSiteName = historyRecord.site_name;
		}

		if (!actualSiteName) {
			return res.status(404).send("Site not found. Please select a valid site from the available fleet.");
		}

		let query = { site_name: actualSiteName };
		if (startDate || endDate) {
			query.created_at = {};
			if (startDate) query.created_at.$gte = new Date(startDate);
			if (endDate) query.created_at.$lte = new Date(endDate);
		}

		const history = await AlertHistory.find(query).sort({ created_at: -1 }).lean();
		const activeAlerts = await Alert.find({ site_name: actualSiteName, status: { $in: ["OPEN", "ACKNOWLEDGED"] } }).sort({ created_at: -1 }).lean();
		
		const historicalMetrics = calculateHistoryMetrics(history);
		const activeMetrics = {
			open: activeAlerts.length,
			offline: activeAlerts.filter(a => a.severity === "OFFLINE").length,
			critical: activeAlerts.filter(a => a.severity === "CRITICAL").length
		};

		const doc = new PDFDocument({ margin: 50 });
		const dateStr = new Date().toISOString().split("T")[0];
		
		res.setHeader("Content-Type", "application/pdf");
		res.setHeader("Content-Disposition", `attachment; filename=Alert_Report_${siteName.replace(/\s+/g, "_")}_${dateStr}.pdf`);

		doc.pipe(res);

		// Header
		doc.fontSize(20).text("SOIC Incident Report", { align: "center" });
		doc.moveDown();
		
		doc.fontSize(12).text(`Site Name: ${siteName}`);
		doc.text(`Report Generated At: ${new Date().toISOString()}`);
		doc.text(`Generated By: SOIC Automated Reporting System`);
		doc.text(`Date Range: ${startDate || 'Lifetime'} to ${endDate || 'Present'}`);
		doc.text(`Total Historical Incidents: ${historicalMetrics.TotalAlerts}`);
		doc.moveDown();

		// Summary
		doc.fontSize(16).text("Summary Metrics", { underline: true });
		doc.moveDown(0.5);
		doc.fontSize(12);
		doc.text(`Total Historical Alerts: ${historicalMetrics.TotalAlerts}`);
		doc.text(`Open Alerts: ${activeMetrics.open}`);
		doc.text(`Offline Alerts: ${activeMetrics.offline}`);
		doc.text(`Current Critical: ${activeMetrics.critical}`);
		doc.text(`Resolved Alerts: ${historicalMetrics.Resolved}`);
		doc.text(`Average Resolution Time: ${historicalMetrics.AverageResolutionTime} Days`);
		doc.text(`Longest Incident: ${historicalMetrics.LongestIncident} Days`);
		doc.text(`Total Days Under Alert: ${historicalMetrics.TotalDaysUnderAlert}`);
		doc.moveDown();

		doc.text(`Historical Severity Breakdown:`);
		const sev = historicalMetrics.SeverityBreakdown;
		doc.text(`  Yellow Alerts: ${sev.YELLOW.count} (${sev.YELLOW.percent}%)`);
		doc.text(`  Orange Alerts: ${sev.ORANGE.count} (${sev.ORANGE.percent}%)`);
		doc.text(`  Red Alerts: ${sev.RED.count} (${sev.RED.percent}%)`);
		doc.text(`  Critical Alerts: ${sev.CRITICAL.count} (${sev.CRITICAL.percent}%)`);
		doc.text(`  Offline Alerts: ${sev.OFFLINE.count} (${sev.OFFLINE.percent}%)`);
		doc.moveDown(2);

		// Incidents
		doc.fontSize(16).text("Incident History", { underline: true });
		doc.moveDown();

		history.forEach(inc => {
			doc.fontSize(12).font("Helvetica-Bold").text(`Incident ID: ${inc.incident_id || inc._id}`);
			doc.font("Helvetica").text(`Start Date: ${inc.incident_start_date || new Date(inc.created_at).toISOString().split("T")[0]}`);
			doc.text(`End Date: ${inc.incident_end_date || 'N/A'}`);
			doc.text(`Highest Severity: ${inc.highest_severity_reached || inc.severity}`);
			doc.text(`Status: ${inc.status}`);
			doc.text(`Days Active: ${inc.total_days_active || inc.consecutive_days}`);
			doc.moveDown(0.5);
			
			if (inc.performance_window && inc.performance_window.length > 0) {
				doc.font("Helvetica-Oblique").text("Evidence Record:");
				inc.performance_window.forEach(ev => {
					doc.font("Helvetica").text(`  [${ev.date}] Predicted: ${ev.predicted_kwh.toFixed(1)} kWh | Actual: ${ev.actual_kwh.toFixed(1)} kWh | Perf: ${ev.performance_percent.toFixed(1)}%`);
				});
			} else {
				doc.text("  No evidence window logged.");
			}
			doc.moveDown(1.5);
		});

		doc.end();
	} catch (error) {
		res.status(500).send(error.message);
	}
};

exports.generateReportExcel = async (req, res) => {
	try {
		const { siteName, startDate, endDate } = req.query;
		if (!siteName) return res.status(400).send("siteName required");

		const siteRegex = new RegExp(`^${siteName.trim()}$`, "i");
		const userRecord = await UserData.findOne({ name: siteRegex, isDeleted: { $ne: true }, status: { $ne: "deleted" } }).lean();
		let actualSiteName = null;

		if (userRecord) {
			actualSiteName = userRecord.name;
		} else {
			const historyRecord = await AlertHistory.findOne({ site_name: siteRegex }).lean();
			if (historyRecord) actualSiteName = historyRecord.site_name;
		}

		if (!actualSiteName) {
			return res.status(404).send("Site not found. Please select a valid site from the available fleet.");
		}

		let query = { site_name: actualSiteName };
		if (startDate || endDate) {
			query.created_at = {};
			if (startDate) query.created_at.$gte = new Date(startDate);
			if (endDate) query.created_at.$lte = new Date(endDate);
		}

		const history = await AlertHistory.find(query).sort({ created_at: -1 }).lean();
		
		// Fetch active incidents for the site
		const activeAlerts = await Alert.find({ site_name: actualSiteName, status: { $in: ["OPEN", "ACKNOWLEDGED"] } }).sort({ created_at: -1 }).lean();

		const historicalMetrics = calculateHistoryMetrics(history);
		const activeMetrics = {
			open: activeAlerts.length,
			offline: activeAlerts.filter(a => a.severity === "OFFLINE").length,
			critical: activeAlerts.filter(a => a.severity === "CRITICAL").length
		};

		const workbook = buildAlertReportWorkbook(siteName, startDate, endDate, historicalMetrics, activeMetrics, history, activeAlerts);

		const dateStr = new Date().toISOString().split("T")[0];
		res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
		res.setHeader("Content-Disposition", `attachment; filename=Alert_Report_${siteName.replace(/\s+/g, "_")}_${dateStr}.xlsx`);

		await workbook.xlsx.write(res);
		res.end();
	} catch (error) {
		res.status(500).send(error.message);
	}
};
