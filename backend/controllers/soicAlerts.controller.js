const mongoose = require("mongoose");
const UserData = require("../models/data");
const SiteDailyPerformance = require("../models/SiteDailyPerformance");
const DailyPrediction = require("../models/DailyPrediction");
const { runSoicPipeline } = require("../services/soicScheduler");

const respondError = (res, message, error, status = 500) => res.status(status).json({
	success: false,
	message,
	error: error?.message || String(error || "Unknown error")
});

const enrichWithUserName = async (records = []) => {
	const userIds = [...new Set(records
		.map((record) => String(record?.user_id || ""))
		.filter((id) => mongoose.Types.ObjectId.isValid(id)))];

	if (!userIds.length) return records;

	const users = await UserData.find({ _id: { $in: userIds } }).select("_id name").lean();
	const namesById = new Map(users.map((user) => [String(user._id), user.name]));

	return records.map((record) => ({
		...record,
		user_name: namesById.get(String(record.user_id)) || record.user_name || ""
	}));
};

const getDashboard = async (req, res) => {
	try {
		const activeUsers = await UserData.find({
			isDeleted: { $ne: true },
			status: { $ne: "deleted" }
		}).lean();
		const activeUserIds = new Set(activeUsers.map(u => String(u._id)));

		const metrics = { total_sites: activeUserIds.size, offline_sites: 0 };

		// Report-page telemetry source of truth
		const latestPredictions = await DailyPrediction.find().sort({ date: -1 }).lean();
		const latestPredictionMap = new Map();
		const isReportingMap = new Map();
		for (const pred of latestPredictions) {
			const uid = String(pred.userId);
			if (!latestPredictionMap.has(uid)) {
				latestPredictionMap.set(uid, pred);
				isReportingMap.set(uid, pred.inverter_real_time_kwh !== "N/A");
			}
		}

		const rows = await SiteDailyPerformance.find().sort({ user_id: 1, date: -1 }).lean();
		const recordsByUser = new Map();
		for (const row of rows) {
			const key = String(row.user_id);
			if (!recordsByUser.has(key)) {
				recordsByUser.set(key, []);
			}
			recordsByUser.get(key).push(row);
		}

		const connectivityIssues = [];
		const activeGenerationIssues = [];
		const liveConnectedSites = [];

		for (const [userId, userRows] of recordsByUser.entries()) {
			if (!activeUserIds.has(userId)) continue;

			const last10Days = userRows.slice(0, 10);
			if (!last10Days.length) continue;

			const todayRow = last10Days[0];
			let expected = todayRow.predicted_generation_kwh || 0;
			let actual = todayRow.actual_generation_kwh || 0;
			
			// SYNC WITH USER REPORT SOURCE OF TRUTH
			const latestPred = latestPredictionMap.get(userId);
			if (latestPred) {
				const parsedExpected = Number(latestPred.predicted_kwh);
				if (Number.isFinite(parsedExpected)) expected = parsedExpected;

				const parsedActual = Number(latestPred.inverter_real_time_kwh);
				if (Number.isFinite(parsedActual)) actual = parsedActual;
				if (latestPred.inverter_real_time_kwh === "N/A") actual = 0;
			}
			
			const diff_kwh = actual - expected;
			const isReporting = isReportingMap.get(userId) ?? !todayRow.inverter_offline;

			let alert_days_10d = 0;
			let consecutive_alert_days = 0;
			let brokenStreak = false;

			for (const day of last10Days) {
				const pr = day.performance_ratio || 0;
				const isAlertDay = pr < 0.90 || day.inverter_offline;
				
				if (isAlertDay) alert_days_10d++;

				if (!brokenStreak) {
					if (isAlertDay) {
						consecutive_alert_days++;
					} else {
						brokenStreak = true;
					}
				}
			}

			// Calculate Severity
			let severity = "HEALTHY";
			if (!isReporting) {
				severity = "LOW";
			} else if (diff_kwh >= 0) {
				severity = "HEALTHY";
			} else {
				if (alert_days_10d >= 8 || expected === 0 || (actual/expected) < 0.50 || consecutive_alert_days >= 3) {
					severity = "CRITICAL";
				} else if ((actual/expected) < 0.70 || (alert_days_10d >= 6 && alert_days_10d <= 7)) {
					severity = "HIGH";
				} else if ((actual/expected) < 0.80 || (alert_days_10d >= 3 && alert_days_10d <= 5)) {
					severity = "MEDIUM";
				} else {
					severity = "LOW";
				}
			}

			const baseSite = {
				user_id: userId,
				severity,
				alert_days_10d,
				consecutive_alert_days,
				expected_output_kwh: Number(expected.toFixed(2)),
				actual_output_kwh: Number(actual.toFixed(2)),
				difference_kwh: Number(diff_kwh.toFixed(2)),
				last_telemetry: latestPred?.updatedAt || todayRow.inverter_last_seen || todayRow.updated_at,
				status: isReporting ? (diff_kwh < 0 ? "Underperforming" : "Connected") : "Not Connected",
				connection_status: isReporting ? "Connected" : "Offline",
				current_generation_kwh: Number(actual.toFixed(2)),
				predicted_generation_kwh: Number(expected.toFixed(2))
			};

			if (!isReporting) {
				connectivityIssues.push(baseSite);
			} else if (diff_kwh < 0) {
				activeGenerationIssues.push(baseSite);
			} else {
				liveConnectedSites.push(baseSite);
			}
		}

		// Update metrics total_sites based on active users
		metrics.total_sites = activeUserIds.size;
		metrics.offline_sites = connectivityIssues.length;

		const enrichedConnectivity = await enrichWithUserName(connectivityIssues);
		const enrichedGeneration = await enrichWithUserName(activeGenerationIssues);
		const enrichedLive = await enrichWithUserName(liveConnectedSites);

		return res.status(200).json({
			success: true,
			data: {
				metrics,
				connectivityIssues: enrichedConnectivity,
				activeGenerationIssues: enrichedGeneration,
				liveConnectedSites: enrichedLive
			}
		});
	} catch (error) {
		return respondError(res, "Failed to fetch SOIC dashboard", error);
	}
};
module.exports = {
	getDashboard
};
