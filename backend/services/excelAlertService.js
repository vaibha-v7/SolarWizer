const ExcelJS = require("exceljs");
const {
	C,
	solidFill,
	thinBorder,
	mediumBorder,
	styleColHeader,
	styleDataCell,
	addSectionHeader,
	addSpacer,
	addKeyValueRows
} = require("../utils/excelStyles");

function applyEvidenceStyling(cell, value) {
	cell.value = value;
	if (typeof value === "number") {
		cell.numFmt = "0.00\\%";
		if (value >= 90) {
			cell.fill = solidFill("FFD4EDDA"); // Green
			cell.font = { color: { argb: "FF155724" } };
		} else if (value >= 70) {
			cell.fill = solidFill("FFFFF3CD"); // Amber
			cell.font = { color: { argb: "FF856404" } };
		} else {
			cell.fill = solidFill("FFF8D7DA"); // Red
			cell.font = { color: { argb: "FF721C24" } };
		}
	} else {
		styleDataCell(cell, "center");
	}
	cell.border = thinBorder();
}

const buildSummarySheet = (wb, siteName, startDate, endDate, historyMetrics, activeMetrics) => {
	const ws = wb.addWorksheet("Summary");
	
	ws.columns = [
		{ key: "A", width: 22 },
		{ key: "B", width: 18 },
		{ key: "C", width: 18 },
		{ key: "D", width: 18 },
		{ key: "E", width: 18 },
		{ key: "F", width: 18 }
	];

	ws.mergeCells("A1:F1");
	const logoCell = ws.getCell("A1");
	logoCell.value = "SolarWizer";
	logoCell.fill = solidFill(C.brandDark);
	logoCell.font = { bold: true, size: 22, color: { argb: C.white }, name: "Calibri" };
	logoCell.alignment = { vertical: "middle", horizontal: "center" };
	logoCell.border = mediumBorder();
	ws.getRow(1).height = 48;

	ws.mergeCells("A2:F2");
	const taglineCell = ws.getCell("A2");
	taglineCell.value = "SOIC Alert Report";
	taglineCell.fill = solidFill(C.brandMid);
	taglineCell.font = { italic: true, size: 12, color: { argb: C.white } };
	taglineCell.alignment = { vertical: "middle", horizontal: "center" };
	ws.getRow(2).height = 22;

	ws.mergeCells("A3:F3");
	const dateCell = ws.getCell("A3");
	dateCell.value = `Generated: ${new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}`;
	dateCell.fill = solidFill(C.brandLight);
	dateCell.font = { italic: true, size: 9, color: { argb: C.brandDark } };
	dateCell.alignment = { horizontal: "center", vertical: "middle" };
	ws.getRow(3).height = 16;

	let r = 4;
	r = addSpacer(ws, r);

	r = addSectionHeader(ws, r, "REPORT DETAILS", C.brandLight, C.brandDark);
	r = addKeyValueRows(ws, r, [
		["Site Name", siteName],
		["Date Range", `${startDate || 'Lifetime'} to ${endDate || 'Present'}`]
	]);

	r = addSpacer(ws, r);

	r = addSectionHeader(ws, r, "EXECUTIVE SUMMARY", C.accentLight, C.accentDark);
	r = addKeyValueRows(ws, r, [
		["Total Historical Alerts", historyMetrics.TotalAlerts],
		["Resolved Alerts", historyMetrics.Resolved],
		["Open Alerts", activeMetrics.open],
		["Offline Alerts", activeMetrics.offline],
		["Current Critical", activeMetrics.critical],
		["Avg Resolution Time", `${historyMetrics.AverageResolutionTime} Days`],
		["Longest Incident", `${historyMetrics.LongestIncident} Days`]
	]);

	r = addSpacer(ws, r);
	r = addSectionHeader(ws, r, "HISTORICAL SEVERITY BREAKDOWN", C.brandLight, C.brandDark);

	["Severity", "Count", "Percentage", "", "", ""].forEach((header, index) => {
		const col = ["A", "B", "C", "D", "E", "F"][index];
		ws.getCell(`${col}${r}`).value = header;
		if (header) styleColHeader(ws.getCell(`${col}${r}`));
	});
	ws.getRow(r).height = 22;
	r += 1;

	const severities = ["YELLOW", "ORANGE", "RED", "CRITICAL", "OFFLINE"];
	severities.forEach((sev, index) => {
		const stat = historyMetrics.SeverityBreakdown[sev];
		ws.getCell(`A${r}`).value = sev;
		ws.getCell(`B${r}`).value = stat.count;
		ws.getCell(`C${r}`).value = stat.percent;

		for (const col of ["D", "E", "F"]) ws.getCell(`${col}${r}`).value = "";

		styleDataCell(ws.getCell(`A${r}`), "left", index % 2 === 0);
		styleDataCell(ws.getCell(`B${r}`), "right", index % 2 === 0);
		styleDataCell(ws.getCell(`C${r}`), "right", index % 2 === 0);
		for (const col of ["D", "E", "F"]) styleDataCell(ws.getCell(`${col}${r}`), "left", index % 2 === 0);
		
		ws.getRow(r).height = 20;
		r += 1;
	});
};

const buildActiveIncidentsSheet = (wb, activeAlerts) => {
	if (!activeAlerts || activeAlerts.length === 0) return;
	const ws = wb.addWorksheet("Active Incidents");

	ws.columns = [
		{ header: "Incident ID", key: "id", width: 28 },
		{ header: "Site Name", key: "site", width: 22 },
		{ header: "Severity", key: "severity", width: 15 },
		{ header: "Status", key: "status", width: 18 },
		{ header: "Days Active", key: "days", width: 15 },
		{ header: "Performance %", key: "perf", width: 18 },
		{ header: "Opened On", key: "opened", width: 20 }
	];

	ws.getRow(1).eachCell(cell => styleColHeader(cell));
	ws.getRow(1).height = 22;
	ws.autoFilter = "A1:G1";
	ws.views = [{ state: "frozen", xSplit: 0, ySplit: 1 }];

	activeAlerts.forEach((inc, index) => {
		const row = ws.addRow({
			id: inc._id.toString(),
			site: inc.site_name,
			severity: inc.severity,
			status: inc.status,
			days: inc.consecutive_days,
			perf: inc.performance_percent,
			opened: new Date(inc.created_at).toISOString().split("T")[0]
		});

		row.eachCell((cell, colNumber) => {
			styleDataCell(cell, colNumber === 2 ? "left" : "center", index % 2 === 0);
			if (colNumber === 6 && typeof cell.value === "number") cell.numFmt = "0.00\\%";
		});
		row.height = 20;
	});
};

const buildHistoricalIncidentsSheet = (wb, history) => {
	const ws = wb.addWorksheet("Historical Incidents");

	ws.columns = [
		{ header: "Incident ID", key: "id", width: 28 },
		{ header: "Site Name", key: "site", width: 22 },
		{ header: "Severity", key: "severity", width: 15 },
		{ header: "Start Date", key: "start", width: 15 },
		{ header: "End Date", key: "end", width: 15 },
		{ header: "Duration", key: "duration", width: 15 },
		{ header: "Resolution Time", key: "res_time", width: 20 },
		{ header: "Status", key: "status", width: 15 }
	];

	ws.getRow(1).eachCell(cell => styleColHeader(cell));
	ws.getRow(1).height = 22;
	ws.autoFilter = "A1:H1";
	ws.views = [{ state: "frozen", xSplit: 0, ySplit: 1 }];

	history.forEach((inc, index) => {
		let resTimeStr = "N/A";
		if (inc.resolved_at && inc.created_at) {
			const ms = new Date(inc.resolved_at) - new Date(inc.created_at);
			const days = Math.round(ms / (1000 * 60 * 60 * 24));
			resTimeStr = `${days} Days`;
		}

		const row = ws.addRow({
			id: inc.incident_id || inc._id.toString(),
			site: inc.site_name,
			severity: inc.highest_severity_reached || inc.severity,
			start: inc.incident_start_date || new Date(inc.created_at).toISOString().split("T")[0],
			end: inc.incident_end_date || "N/A",
			duration: inc.total_days_active || inc.consecutive_days || 0,
			res_time: resTimeStr,
			status: inc.status
		});

		row.eachCell((cell, colNumber) => {
			styleDataCell(cell, colNumber === 2 ? "left" : "center", index % 2 === 0);
		});
		row.height = 20;
	});
};

const buildPerformanceEvidenceSheet = (wb, activeAlerts, history) => {
	const ws = wb.addWorksheet("Performance Evidence");

	ws.columns = [
		{ header: "Incident ID", key: "id", width: 28 },
		{ header: "Date", key: "date", width: 15 },
		{ header: "Predicted (kWh)", key: "pred", width: 18 },
		{ header: "Actual (kWh)", key: "act", width: 18 },
		{ header: "Difference (kWh)", key: "diff", width: 18 },
		{ header: "Performance %", key: "perf", width: 15 }
	];

	ws.getRow(1).eachCell(cell => styleColHeader(cell));
	ws.getRow(1).height = 22;
	ws.autoFilter = "A1:F1";
	ws.views = [{ state: "frozen", xSplit: 0, ySplit: 1 }];

	const allIncidents = [
		...activeAlerts.map(a => ({ id: a._id.toString(), window: a.performance_window || [] })),
		...history.map(h => ({ id: h.incident_id || h._id.toString(), window: h.performance_window || [] }))
	];

	let rowIndex = 0;
	allIncidents.forEach((inc) => {
		inc.window.forEach((ev) => {
			const row = ws.addRow({
				id: inc.id,
				date: ev.date,
				pred: ev.predicted_kwh,
				act: ev.actual_kwh,
				diff: ev.difference_kwh,
				perf: ev.performance_percent
			});

			row.eachCell((cell, colNumber) => {
				if (colNumber === 6) {
					applyEvidenceStyling(cell, ev.performance_percent);
				} else {
					styleDataCell(cell, colNumber === 1 ? "left" : "center", rowIndex % 2 === 0);
					if ([3, 4, 5].includes(colNumber) && typeof cell.value === "number") cell.numFmt = "#,##0.00";
				}
			});
			row.height = 20;
			rowIndex++;
		});
	});
};

const buildAlertReportWorkbook = (siteName, startDate, endDate, historyMetrics, activeMetrics, history, activeAlerts) => {
	const wb = new ExcelJS.Workbook();
	wb.creator = "SolarWizer";
	wb.created = new Date();
	wb.modified = new Date();

	buildSummarySheet(wb, siteName, startDate, endDate, historyMetrics, activeMetrics);
	buildActiveIncidentsSheet(wb, activeAlerts);
	buildHistoricalIncidentsSheet(wb, history);
	buildPerformanceEvidenceSheet(wb, activeAlerts, history);

	return wb;
};

module.exports = { buildAlertReportWorkbook };
