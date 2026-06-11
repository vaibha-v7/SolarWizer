const SiteDailyPerformance = require("../models/SiteDailyPerformance");
const DailyPrediction = require("../models/DailyPrediction");
const MonthlyData = require("../models/monthlydata");
const UserData = require("../models/data");
const SiteBaselineProfile = require("../models/SiteBaselineProfile");
const { detectAnomaly } = require("../utils/anomalyDetector");

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const RETENTION_DAYS = 30;

const safeNumber = (value, fallback = 0) => {
	const parsed = Number(value);
	return Number.isFinite(parsed) ? parsed : fallback;
};

const average = (items) => {
	const values = items.map(Number).filter(Number.isFinite);
	if (!values.length) return 0;
	return values.reduce((sum, value) => sum + value, 0) / values.length;
};

const normalizeRatio = (value, fallback = 0) => {
	const ratio = safeNumber(value, fallback);
	if (ratio > 2) return ratio / 100;
	return ratio;
};

const getDateString = (date = new Date()) => date.toISOString().split("T")[0];

const getDateDaysAgo = (daysAgo) => {
	const date = new Date();
	date.setUTCDate(date.getUTCDate() - daysAgo);
	return getDateString(date);
};

const getLastNDates = (days = RETENTION_DAYS) => {
	const dates = [];
	for (let index = 0; index < days; index += 1) {
		dates.push(getDateDaysAgo(index));
	}
	return dates;
};

const getMonthNameForDate = (dateString) => {
	const date = new Date(`${dateString}T00:00:00.000Z`);
	return MONTHS[date.getUTCMonth()] || MONTHS[new Date().getUTCMonth()];
};

const getDaysInMonth = (dateString) => {
	const date = new Date(`${dateString}T00:00:00.000Z`);
	return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate();
};

const computeDesignPerformanceRatio = (user = {}, monthlyReport = {}) => {
	const reportRatio = normalizeRatio(monthlyReport.performance_ratio);
	if (reportRatio > 0) return reportRatio;

	const shading = Math.max(0, Math.min(1, safeNumber(user.shadingFactor, 0.95)));
	const inverterEfficiency = Math.max(0, Math.min(1, safeNumber(user.inv_efficiency, 98) / 100));
	const losses = [
		user.soilingLossPercent,
		user.inverterLossPercent,
		user.wiringLossPercent,
		user.miscLossPercent
	].map((loss) => Math.max(0, Math.min(60, safeNumber(loss))));

	const lossMultiplier = losses.reduce((multiplier, loss) => multiplier * (1 - loss / 100), 1);
	const ratio = shading * inverterEfficiency * lossMultiplier;
	return Number(Math.max(0.55, Math.min(1.05, ratio || 0.88)).toFixed(4));
};

const parseActualKwh = (value) => {
	if (value === null || value === undefined) return null;
	if (typeof value === "string" && ["", "N/A", "NA", "NULL", "UNAVAILABLE"].includes(value.trim().toUpperCase())) {
		return null;
	}

	const parsed = Number(value);
	return Number.isFinite(parsed) ? parsed : null;
};

const getReportDailyKwh = (monthlyReport = {}, dateString = getDateString()) => {
	const month = getMonthNameForDate(dateString);
	const monthlyValue = safeNumber(monthlyReport.monthly_energy_kwh?.[month]);
	if (monthlyValue > 0) {
		return monthlyValue / getDaysInMonth(dateString);
	}

	const annualValue = safeNumber(monthlyReport.annual_energy_kwh);
	return annualValue > 0 ? annualValue / 365 : 0;
};

const findForecastForDate = (monthlyReport = {}, dateString) => {
	const forecasts = Array.isArray(monthlyReport.forecast_7_days) ? monthlyReport.forecast_7_days : [];
	return forecasts.find((item) => item.date === dateString) || null;
};

const getModelSource = (monthlyReport = {}) => {
	if (monthlyReport.pvgis?.source && monthlyReport.pvwatts?.source) return "PVGIS+PVWatts";
	if (monthlyReport.pvgis?.source) return "PVGIS";
	if (monthlyReport.pvwatts?.source) return "PVWatts";
	return "AIML report";
};

const getMonthlyReportSources = (monthlyReport = {}) => {
	const sources = [];
	if (monthlyReport._id) sources.push("MonthlyData");
	if (monthlyReport.pvgis && Object.keys(monthlyReport.pvgis).length) sources.push("PVGIS report");
	if (monthlyReport.pvwatts && Object.keys(monthlyReport.pvwatts).length) sources.push("PVWatts report");
	if (Array.isArray(monthlyReport.forecast_7_days) && monthlyReport.forecast_7_days.length) sources.push("AIML 7-day forecast");
	return sources;
};

const getBaselineRatio = (baseline, user, monthlyReport) =>
	normalizeRatio(baseline?.baseline_performance_ratio, computeDesignPerformanceRatio(user, monthlyReport));

const buildSnapshotPayload = async ({ user, monthlyReport, prediction, date, dataSource }) => {
	const forecast = findForecastForDate(monthlyReport, date);
	const designRatio = computeDesignPerformanceRatio(user, monthlyReport);
	const baseline = await SiteBaselineProfile.findOne({ user_id: user._id }).lean();
	const baselineRatio = getBaselineRatio(baseline, user, monthlyReport);
	const predicted =
		safeNumber(prediction?.predicted_kwh) ||
		safeNumber(forecast?.predicted_kwh) ||
		getReportDailyKwh(monthlyReport, date);
	const actualTelemetry = parseActualKwh(prediction?.inverter_real_time_kwh);
	const hasActualTelemetry = actualTelemetry !== null;
	const actual = hasActualTelemetry ? actualTelemetry : predicted * designRatio;
	const ratio = predicted > 0 ? (hasActualTelemetry ? actual / predicted : designRatio) : designRatio;
	const differenceKwh = hasActualTelemetry && predicted > 0 ? actual - predicted : 0;
	const differencePercent = hasActualTelemetry && predicted > 0 ? (differenceKwh / predicted) * 100 : 0;
	const history = await SiteDailyPerformance.find({ user_id: user._id, date: { $lt: date } })
		.sort({ date: -1 })
		.limit(30)
		.lean();
	const anomalyCheck = detectAnomaly(ratio, history.map((item) => item.performance_ratio));
	const hasTelemetrySource = Boolean(String(user.inverterSerialNumber || "").trim() || String(user.siteId || "").trim());
	const telemetryMissing = Boolean(prediction && hasTelemetrySource && !hasActualTelemetry);
	const baselineDriftPercent = baselineRatio > 0 ? ((ratio - baselineRatio) / baselineRatio) * 100 : 0;
	const sources = [
		...(prediction ? ["DailyPrediction"] : []),
		...getMonthlyReportSources(monthlyReport),
		hasActualTelemetry ? "inverter generation" : "SOIC report-derived estimate",
		"UserData system specs"
	];

	return {
		user_id: user._id,
		date,
		predicted_generation_kwh: Number(predicted.toFixed(2)),
		actual_generation_kwh: Number(actual.toFixed(2)),
		inverter_offline: false,
		inverter_last_seen: hasActualTelemetry ? new Date(`${date}T19:00:00.000Z`) : null,
		data_source: dataSource,
		data_sources: [...new Set(sources)],
		daily_prediction_id: prediction?._id || null,
		monthly_report_id: monthlyReport?._id || null,
		model_source: getModelSource(monthlyReport),
		difference_kwh: Number(differenceKwh.toFixed(2)),
		difference_percent: Number(differencePercent.toFixed(2)),
		performance_ratio: Number(ratio.toFixed(4)),
		report_performance_ratio: Number(designRatio.toFixed(4)),
		avg_temperature_c: safeNumber(prediction?.avg_temperature, safeNumber(forecast?.temperature)),
		avg_cloud_cover_percent: safeNumber(prediction?.avg_cloud_cover, safeNumber(forecast?.cloud_cover)),
		peak_ghi_w_per_m2: safeNumber(prediction?.peak_power_kw),
		peak_power_kw: safeNumber(prediction?.peak_power_kw),
		site_baseline_ratio: Number(baselineRatio.toFixed(4)),
		baseline_drift_percent: Number(baselineDriftPercent.toFixed(2)),
		global_benchmark_ratio: 1,
		analytics_confidence: hasActualTelemetry ? 0.92 : prediction ? 0.72 : 0.62,
		reasoning_summary: hasActualTelemetry
			? "SOIC snapshot combines AIML daily prediction with inverter generation telemetry."
			: "SOIC snapshot uses existing report and forecast outputs because inverter telemetry is unavailable.",
		probable_causes: [],
		maintenance_recommendations: [],
		projected_risk_timeline_days: null,
		is_anomaly: anomalyCheck.isAnomaly,
		anomaly_score: Number(anomalyCheck.zScore.toFixed(4)),
		is_suspicious: Math.abs(anomalyCheck.zScore) >= 3,
		is_data_quality_issue: telemetryMissing,
		alert_triggered: false,
		alert_types_triggered: []
	};
};

async function upsertSiteDailyPerformance(payload) {
	return SiteDailyPerformance.findOneAndUpdate(
		{ user_id: payload.user_id, date: payload.date },
		payload,
		{ upsert: true, returnDocument: "after" }
	);
}

const computeWindows = (ratios = []) => ({
	daily: ratios[0] ?? 0,
	avg7: average(ratios.slice(0, 7)),
	avg30: average(ratios.slice(0, 30)),
	avg90: average(ratios.slice(0, 90)),
	lifetime: average(ratios)
});

async function createOrUpdateSiteDailyPerformance({ userId } = {}) {
	const query = userId ? { _id: userId } : {};
	const users = await UserData.find(query).lean();
	if (!users.length) return { processedUsers: 0, upsertedSnapshots: 0, windowSummary: [] };

	const userIds = users.map((user) => user._id);
	const cutoffDateStr = getDateDaysAgo(RETENTION_DAYS - 1);
	const [monthlyReports, predictions] = await Promise.all([
		MonthlyData.find({ userDataId: { $in: userIds } }).lean(),
		DailyPrediction.find({
			userId: { $in: userIds },
			date: { $gte: cutoffDateStr }
		})
			.sort({ date: -1 })
			.lean()
	]);

	const monthlyByUser = new Map(monthlyReports.map((report) => [String(report.userDataId), report]));
	const predictionsByUser = predictions.reduce((map, prediction) => {
		const key = String(prediction.userId);
		if (!map.has(key)) map.set(key, []);
		map.get(key).push(prediction);
		return map;
	}, new Map());

	let upsertedSnapshots = 0;
	for (const user of users) {
		const userKey = String(user._id);
		const monthlyReport = monthlyByUser.get(userKey) || {};
		const userPredictions = predictionsByUser.get(userKey) || [];
		const predictionDates = new Set();

		for (const prediction of userPredictions) {
			predictionDates.add(prediction.date);
			const hasTelemetry = parseActualKwh(prediction.inverter_real_time_kwh) !== null;
			const payload = await buildSnapshotPayload({
				user,
				monthlyReport,
				prediction,
				date: prediction.date,
				dataSource: hasTelemetry ? "daily_prediction_inverter" : "daily_prediction_forecast"
			});
			await upsertSiteDailyPerformance(payload);
			upsertedSnapshots += 1;
		}

		if (monthlyReport._id) {
			for (const date of getLastNDates(RETENTION_DAYS)) {
				if (predictionDates.has(date)) continue;
				const payload = await buildSnapshotPayload({
					user,
					monthlyReport,
					prediction: null,
					date,
					dataSource: "monthly_report_baseline"
				});
				await upsertSiteDailyPerformance(payload);
				upsertedSnapshots += 1;
			}
		}

		await SiteDailyPerformance.deleteMany({
			user_id: user._id,
			date: { $lt: cutoffDateStr }
		});
	}

	const windowSummary = [];
	for (const id of userIds) {
		const ratios = await SiteDailyPerformance.find({ user_id: id })
			.sort({ date: -1 })
			.limit(RETENTION_DAYS)
			.select("performance_ratio")
			.lean();
		windowSummary.push({
			user_id: id,
			...computeWindows(ratios.map((item) => item.performance_ratio))
		});
	}

	return { processedUsers: users.length, upsertedSnapshots, windowSummary };
}

module.exports = {
	createOrUpdateSiteDailyPerformance,
	computeWindows,
	computeDesignPerformanceRatio,
	RETENTION_DAYS
};
