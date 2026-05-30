const Alert = require("../models/Alert");
const UserData = require("../models/data");
const MonthlyData = require("../models/monthlydata");
const SiteDailyPerformance = require("../models/SiteDailyPerformance");
const SiteBaselineProfile = require("../models/SiteBaselineProfile");
const SiteTrendAnalysis = require("../models/SiteTrendAnalysis");
const { buildOperationalReasoning } = require("./soicReasoningLayer");

const priorityWeight = { P0: 1, P1: 2, P2: 3, P3: 4, P4: 5, P5: 6 };

const safeNumber = (value, fallback = 0) => {
	const parsed = Number(value);
	return Number.isFinite(parsed) ? parsed : fallback;
};

const normalizeRatio = (value, fallback = 0) => {
	const ratio = safeNumber(value, fallback);
	if (ratio > 2) return ratio / 100;
	return ratio;
};

const getPriorityForLoss = (lossPercent, days) => {
	if (lossPercent >= 30) return "P5";
	if (lossPercent >= 18 && days >= 3) return "P4";
	if (lossPercent >= 12 && days >= 3) return "P3";
	if (lossPercent >= 8 && days >= 3) return "P2";
	if (lossPercent >= 4 && days >= 3) return "P1";
	return "P0";
};

const getActiveStatus = (existing) => (existing?.status === "CREATED" ? "ACTIVE" : existing?.status || "ACTIVE");

const getTriggeredAt = (dateString) => new Date(`${dateString}T00:00:00.000Z`);

const createOrUpdateAlert = async (payload) => {
	const dayStart = new Date(payload.triggered_at);
	dayStart.setUTCHours(0, 0, 0, 0);
	const dayEnd = new Date(dayStart);
	dayEnd.setUTCDate(dayEnd.getUTCDate() + 1);

	const existing = await Alert.findOne({
		user_id: payload.user_id,
		alert_type: payload.alert_type,
		triggered_at: { $gte: dayStart, $lt: dayEnd }
	});

	if (!existing) {
		return Alert.create(payload);
	}

	const shouldEscalate = priorityWeight[payload.priority] > priorityWeight[existing.priority];
	const escalation_history = Array.isArray(existing.escalation_history) ? existing.escalation_history : [];

	return Alert.findByIdAndUpdate(
		existing._id,
		{
			...payload,
			status: payload.status || (shouldEscalate ? "ESCALATED" : getActiveStatus(existing)),
			escalation_count: shouldEscalate ? (existing.escalation_count || 0) + 1 : existing.escalation_count,
			escalation_history: shouldEscalate
				? [...escalation_history, { from: existing.priority, to: payload.priority, at: new Date() }]
				: escalation_history
		},
		{ returnDocument: "after" }
	);
};

const upsertNoRealTimeDataAlert = async (payload) => {
	const existing = await Alert.findOne({
		user_id: payload.user_id,
		alert_type: payload.alert_type,
		status: { $in: ["CREATED", "ACTIVE", "ESCALATED"] }
	}).sort({ triggered_at: -1, created_at: -1 });

	if (existing) {
		return Alert.findByIdAndUpdate(
			existing._id,
			{
				...payload,
				status: getActiveStatus(existing),
				escalation_history: existing.escalation_history || [],
				escalation_count: existing.escalation_count || 0
			},
			{ returnDocument: "after" }
		);
	}

	return Alert.create(payload);
};

async function autoResolveClearedAlerts(userId, baseline) {
	const activeAlerts = await Alert.find({
		user_id: userId,
		status: { $in: ["CREATED", "ACTIVE", "ESCALATED"] }
	}).lean();

	const latest = await SiteDailyPerformance.findOne({ user_id: userId }).sort({ date: -1 }).lean();
	const baselineRatio = normalizeRatio(baseline?.baseline_performance_ratio, normalizeRatio(latest?.site_baseline_ratio, 0.9));
	const warningThreshold = normalizeRatio(baseline?.warning_threshold, baselineRatio * 0.92);
	if (!latest || latest.performance_ratio < warningThreshold || latest.is_data_quality_issue) return 0;

	let resolved = 0;
	for (const alert of activeAlerts) {
		await Alert.findByIdAndUpdate(alert._id, {
			status: "AUTO_RESOLVED",
			auto_resolved_at: new Date(),
			resolved_at: new Date(),
			resolution_reason: "SOIC condition cleared against site baseline"
		});
		resolved += 1;
	}
	return resolved;
}

async function evaluateAlertsForUser(userId) {
	const [user, baseline, history, monthlyReport, trend30] = await Promise.all([
		UserData.findById(userId).lean(),
		SiteBaselineProfile.findOne({ user_id: userId }).lean(),
		SiteDailyPerformance.find({ user_id: userId }).sort({ date: -1 }).limit(30).lean(),
		MonthlyData.findOne({ userDataId: userId }).lean(),
		SiteTrendAnalysis.findOne({ user_id: userId, analysis_period: "30day" }).lean()
	]);

	if (!user || !history.length) return { createdOrUpdated: 0, autoResolved: 0 };

	const latest = history[0];
	const previousDay = history[1];
	const baselineRatio = normalizeRatio(baseline?.baseline_performance_ratio, normalizeRatio(latest.site_baseline_ratio, 0.9));
	const warningThreshold = normalizeRatio(baseline?.warning_threshold, baselineRatio * 0.92);
	const criticalThreshold = normalizeRatio(baseline?.critical_threshold, baselineRatio * 0.85);
	const consecutiveUnder = history.findIndex((day) => normalizeRatio(day.performance_ratio) >= warningThreshold) === -1
		? history.length
		: history.findIndex((day) => normalizeRatio(day.performance_ratio) >= warningThreshold);
	const lossPercent = Math.max(0, ((baselineRatio - normalizeRatio(latest.performance_ratio)) / Math.max(baselineRatio, 0.01)) * 100);
	const hasActualTelemetry = latest.data_source === "daily_prediction_inverter";
	const clearWeather = safeNumber(latest.avg_cloud_cover_percent) <= 35;
	const highTemperature = safeNumber(latest.avg_temperature_c) >= 42;
	const reasoning = buildOperationalReasoning({
		user,
		latest,
		history,
		baseline,
		trend: trend30,
		monthlyReport
	});

	const makePayload = ({
		alertType,
		priority,
		title,
		description,
		shortMessage,
		status = "ACTIVE",
		extra = {}
	}) => ({
		user_id: userId,
		alert_type: alertType,
		priority,
		title,
		description,
		short_message: shortMessage,
		confidence_score: reasoning.confidence_score,
		confidence_distribution: reasoning.confidence_distribution,
		status,
		triggered_at: getTriggeredAt(latest.date),
		baseline_performance: Number(baselineRatio.toFixed(4)),
		actual_performance: Number(normalizeRatio(latest.performance_ratio).toFixed(4)),
		variance_from_baseline: Number((normalizeRatio(latest.performance_ratio) - baselineRatio).toFixed(4)),
		consecutive_days_triggered: consecutiveUnder || 1,
		possible_causes: reasoning.possible_causes,
		maintenance_recommendations: reasoning.maintenance_recommendations,
		projected_risk_timeline_days: reasoning.projected_risk_timeline_days,
		reasoning_summary: reasoning.reasoning_summary,
		data_sources: latest.data_sources || [],
		days_active: consecutiveUnder || 1,
		...extra
	});

	const alertsToUpsert = [];

	if (!hasActualTelemetry) {
		const noRealTimeAlert = makePayload({
			alertType: "No Real-Time Data",
			priority: "P1",
			title: "No real-time data available",
			description: "Real-time inverter data not available - This site needs to be configured first.",
			shortMessage: "Real-time inverter data not available"
		});

		const primaryAlert = await upsertNoRealTimeDataAlert(noRealTimeAlert);
		let autoResolved = 0;

		const resolvedResult = await Alert.updateMany(
			{
				user_id: userId,
				status: { $in: ["CREATED", "ACTIVE", "ESCALATED"] },
				_id: { $ne: primaryAlert._id }
			},
			{
				$set: {
					status: "AUTO_RESOLVED",
					auto_resolved_at: new Date(),
					resolved_at: new Date(),
					resolution_reason: "Waiting for real-time inverter setup"
				}
			}
		);
		autoResolved += resolvedResult?.modifiedCount || 0;

		await SiteDailyPerformance.findByIdAndUpdate(latest._id, {
			alert_triggered: true,
			alert_types_triggered: [noRealTimeAlert.alert_type],
			probable_causes: reasoning.possible_causes,
			maintenance_recommendations: reasoning.maintenance_recommendations,
			projected_risk_timeline_days: reasoning.projected_risk_timeline_days,
			reasoning_summary: reasoning.reasoning_summary,
			analytics_confidence: reasoning.confidence_score
		});

		return { createdOrUpdated: 1, autoResolved };
	}

	if (consecutiveUnder >= 3 && normalizeRatio(latest.performance_ratio) < warningThreshold) {
		alertsToUpsert.push(makePayload({
			alertType: "Persistent Underperformance",
			priority: getPriorityForLoss(lossPercent, consecutiveUnder),
			title: "Output has stayed low for several days",
			description: `Production has stayed below normal for ${consecutiveUnder} days.`,
			shortMessage: "Production has been low for multiple days"
		}));
	}

	if (history.length >= 14 && trend30?.trend_direction === "declining" && ["medium", "high"].includes(trend30.trend_severity)) {
		alertsToUpsert.push(makePayload({
			alertType: "Performance Drift",
			priority: trend30.trend_severity === "high" ? "P3" : "P2",
			title: "Output is gradually declining",
			description: "Recent production trend shows a steady drop.",
			shortMessage: "Production trend is going down"
		}));
	}

	if (hasActualTelemetry && lossPercent >= 25) {
		alertsToUpsert.push(makePayload({
			alertType: "Sudden Production Drop",
			priority: "P5",
			title: "Production dropped sharply",
			description: "Production is significantly below expected.",
			shortMessage: "Production is significantly below expected"
		}));
	}

	if (hasActualTelemetry && latest.actual_generation_kwh <= 0 && latest.predicted_generation_kwh > 0) {
		alertsToUpsert.push(makePayload({
			alertType: "Site Offline",
			priority: "P5",
			title: "No power output detected",
			description: "The site is not showing any real-time production.",
			shortMessage: "No power output detected"
		}));
	}

	if (latest.is_data_quality_issue) {
		alertsToUpsert.push(makePayload({
			alertType: "Data Quality Issue",
			priority: "P1",
			title: "No real-time data available",
			description: "Real-time inverter data is missing for this site.",
			shortMessage: "No real-time data available"
		}));
	}

	if (clearWeather && normalizeRatio(latest.performance_ratio) < warningThreshold) {
		alertsToUpsert.push(makePayload({
			alertType: "Weather Mismatch",
			priority: "P2",
			title: "Output is low even in good weather",
			description: "Good weather but low output suggests the site needs attention.",
			shortMessage: "Good weather but low output"
		}));
	}

	if (highTemperature && normalizeRatio(latest.performance_ratio) < warningThreshold) {
		alertsToUpsert.push(makePayload({
			alertType: "Thermal Issue",
			priority: "P2",
			title: "High temperature affecting output",
			description: "Hot weather is reducing site production.",
			shortMessage: "High temperature affecting output"
		}));
	}

	if (clearWeather && !highTemperature && normalizeRatio(latest.performance_ratio) < criticalThreshold) {
		alertsToUpsert.push(makePayload({
			alertType: "Shading Detection",
			priority: "P2",
			title: "Panels may need cleaning or inspection",
			description: "Low output may be caused by dirt, shade, or blockage.",
			shortMessage: "Panels may need cleaning or inspection"
		}));
	}

	if (latest.is_anomaly) {
		alertsToUpsert.push(makePayload({
			alertType: "Anomaly Detected",
			priority: "P2",
			title: "Unexpected performance pattern detected",
			description: "Site performance is behaving differently than usual.",
			shortMessage: "Unexpected performance pattern detected"
		}));
	}

	if (
		previousDay &&
		normalizeRatio(previousDay.performance_ratio) < warningThreshold &&
		normalizeRatio(latest.performance_ratio) >= warningThreshold
	) {
		alertsToUpsert.push(makePayload({
			alertType: "Recovery Alert",
			priority: "P0",
			title: "Production is back to normal",
			description: "The site has returned to expected output levels.",
			shortMessage: "Performance has recovered",
			status: "AUTO_RESOLVED",
			extra: {
				resolved_at: new Date(),
				auto_resolved_at: new Date(),
				resolution_reason: "Recovered against SOIC baseline"
			}
		}));
	}

	let createdOrUpdated = 0;
	for (const alertPayload of alertsToUpsert) {
		await createOrUpdateAlert(alertPayload);
		createdOrUpdated += 1;
	}

	await SiteDailyPerformance.findByIdAndUpdate(latest._id, {
		alert_triggered: alertsToUpsert.some((item) => item.status !== "AUTO_RESOLVED"),
		alert_types_triggered: alertsToUpsert.map((item) => item.alert_type),
		probable_causes: reasoning.possible_causes,
		maintenance_recommendations: reasoning.maintenance_recommendations,
		projected_risk_timeline_days: reasoning.projected_risk_timeline_days,
		reasoning_summary: reasoning.reasoning_summary,
		analytics_confidence: reasoning.confidence_score
	});

	const autoResolved = await autoResolveClearedAlerts(userId, baseline);
	return { createdOrUpdated, autoResolved };
}

module.exports = {
	evaluateAlertsForUser
};
