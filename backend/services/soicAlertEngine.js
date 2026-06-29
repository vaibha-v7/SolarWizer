const mongoose = require("mongoose");
const UserData = require("../models/data");
const DailyPrediction = require("../models/DailyPrediction");
const Alert = require("../models/Alert");
const AlertHistory = require("../models/AlertHistory");
const SiteMonitoringState = require("../models/SiteMonitoringState");
const notificationService = require("./notificationService");
const { getTodayDateString, normalizeDateString } = require("../utils/dateUtils");

const UNDERPERFORMANCE_THRESHOLD = Number(process.env.SOIC_PERF_THRESHOLD || 90);

const generateIncidentId = () => {
	return `INC-${new Date().getFullYear()}-${Math.floor(Math.random() * 1000000).toString().padStart(6, "0")}`;
};

const withSession = (query, session) => (session ? query.session(session) : query);

const saveWithSession = (doc, session) => doc.save(session ? { session } : undefined);

const isTransactionUnsupported = (error) => {
	const message = String(error?.message || "");
	return (
		message.includes("Transaction numbers are only allowed") ||
		message.includes("replica set member or mongos") ||
		message.includes("Current topology does not support sessions")
	);
};

const runWithOptionalTransaction = async (operation) => {
	const session = await mongoose.startSession();
	try {
		let result;
		await session.withTransaction(async () => {
			result = await operation(session);
		});
		return result;
	} catch (error) {
		if (!isTransactionUnsupported(error)) throw error;
		console.warn("[SOIC Alert Engine] MongoDB transactions unavailable; using idempotent non-transactional writes");
		return operation(null);
	} finally {
		await session.endSession();
	}
};

const clonePerformanceWindow = (state) => (
	Array.isArray(state.performance_window)
		? state.performance_window.map((item) => ({
			date: item.date,
			predicted_kwh: item.predicted_kwh,
			actual_kwh: item.actual_kwh,
			difference_kwh: item.difference_kwh,
			performance_percent: item.performance_percent
		}))
		: []
);

const addOrReplaceWindowRecord = (state, record) => {
	const existingIdx = state.performance_window.findIndex((item) => item.date === record.date);
	if (existingIdx >= 0) {
		state.performance_window[existingIdx] = record;
	} else {
		state.performance_window.push(record);
	}
	state.performance_window.sort((a, b) => new Date(a.date) - new Date(b.date));
};

const trimPerformanceWindow = (state) => {
	const limit = state.active_alert_id ? 30 : 7;
	if (state.performance_window.length > limit) {
		state.performance_window = state.performance_window.slice(-limit);
	}
};

const getSeverityForConsecutiveDays = (days) => {
	if (days >= 10) return "CRITICAL";
	if (days >= 7) return "RED";
	if (days >= 5) return "ORANGE";
	if (days >= 3) return "YELLOW";
	return null;
};

const getDaysActive = (date, startDate) => {
	const msPerDay = 1000 * 60 * 60 * 24;
	const todayMs = new Date(`${date}T00:00:00.000Z`).getTime();
	const startMs = new Date(new Date(startDate).toISOString().split("T")[0]).getTime();
	return Math.floor((todayMs - startMs) / msPerDay) + 1;
};

const finalizePredictionForEvaluation = async ({ prediction, pipelineId, session }) => {
	prediction.alert_evaluated_at = prediction.alert_evaluated_at || new Date();
	prediction.alert_evaluation_id = prediction.alert_evaluation_id || pipelineId || "";
	prediction.finalized_at = prediction.finalized_at || prediction.alert_evaluated_at;
	prediction.sample_type = "FINAL";
	await saveWithSession(prediction, session);
};

const resolveAlert = async (alert, state, resolvedBy = "System", options = {}) => {
	const session = options.session || null;

	alert.status = "RESOLVED";
	alert.resolved_at = new Date();
	alert.resolved_by = resolvedBy;
	await saveWithSession(alert, session);

	const incident_start_date = new Date(alert.created_at).toISOString().split("T")[0];
	const incident_end_date = alert.resolved_at.toISOString().split("T")[0];
	const historyWindow = clonePerformanceWindow(state);

	const history = new AlertHistory({
		alert_id: alert._id,
		user_id: alert.user_id,
		site_id: alert.site_id,
		site_name: alert.site_name,
		incident_id: generateIncidentId(),
		incident_start_date,
		incident_end_date,
		highest_severity_reached: alert.severity,
		total_days_active: alert.consecutive_days,
		status: "RESOLVED",
		performance_window: historyWindow,
		notes: alert.notes,
		resolved_at: alert.resolved_at,
		resolved_by: alert.resolved_by
	});
	const previewMode = options.previewMode || false;

	if (!previewMode) {
		alert.status = "RESOLVED";
		alert.resolved_at = new Date();
		alert.resolved_by = resolvedBy;
		await saveWithSession(alert, session);

		const incident_start_date = new Date(alert.created_at).toISOString().split("T")[0];
		const incident_end_date = alert.resolved_at.toISOString().split("T")[0];
		const historyWindow = clonePerformanceWindow(state);

		const history = new AlertHistory({
			alert_id: alert._id,
			user_id: alert.user_id,
			site_id: alert.site_id,
			site_name: alert.site_name,
			incident_id: generateIncidentId(),
			incident_start_date,
			incident_end_date,
			highest_severity_reached: alert.severity,
			total_days_active: alert.consecutive_days,
			status: "RESOLVED",
			performance_window: historyWindow,
			notes: alert.notes,
			resolved_at: alert.resolved_at,
			resolved_by: alert.resolved_by
		});
		await saveWithSession(history, session);
	}

	if (state.performance_window.length > 3) {
		state.performance_window = state.performance_window.slice(-3);
	}
	state.consecutive_underperformance_days = 0;
	state.active_alert_id = null;
	state.alert_cooldown_active = true;
	if (!previewMode) {
		await saveWithSession(state, session);
	}

	return alert;
};

const saveAlertWithSeverity = async ({ alert, newSeverity, session, notificationActions, previewMode = false }) => {
	const severityChanged = alert.severity !== newSeverity;
	if (severityChanged) {
		alert.severity = newSeverity;
	}

	if (!previewMode) {
		await saveWithSession(alert, session);
	}

	if (severityChanged && !previewMode) {
		notificationActions.push({ type: "upgraded", alert: alert.toObject ? alert.toObject() : alert });
	}

	return severityChanged;
};

const buildSummary = ({ date, pipelineId }) => ({
	status: "SUCCESS",
	pipelineId,
	businessDate: date,
	sitesExpected: 0,
	sitesProcessed: 0,
	sitesSkipped: 0,
	alertsCreated: 0,
	alertsEscalated: 0,
	alertsResolved: 0,
	notificationsSent: 0,
	failures: [],
	warnings: []
});

const evaluateSite = async ({ user, date, pipelineId, session, forceReevaluate = false, previewMode = false }) => {
	const notificationActions = [];
	const siteResult = {
		status: "processed",
		alertsCreated: 0,
		alertsEscalated: 0,
		alertsResolved: 0,
		notificationActions,
		warnings: [],
		preview_payload: null
	};

	const prediction = await withSession(
		DailyPrediction.findOne({ userId: user._id, date }),
		session
	);

	if (!prediction) {
		siteResult.status = "skipped";
		siteResult.warnings.push({ userId: String(user._id), siteName: user.name, message: "PREDICTION_UNAVAILABLE" });
		return siteResult;
	}

	let state = await withSession(SiteMonitoringState.findOne({ user_id: user._id }), session);

	if ((prediction.alert_evaluated_at || state?.last_evaluated_date === date) && !forceReevaluate && !previewMode) {
		if (!prediction.finalized_at) {
			await finalizePredictionForEvaluation({ prediction, pipelineId, session });
		}
		siteResult.status = "skipped";
		siteResult.warnings.push({ userId: String(user._id), siteName: user.name, message: "Duplicate evaluation ignored" });
		return siteResult;
	}

	if (!state) {
		state = new SiteMonitoringState({ user_id: user._id, performance_window: [] });
	}

	const systemCapacity = user.systemCapacity || 0;
	const maxValidGeneration = systemCapacity * 12;
	const predictedKwh = Number(prediction.predicted_kwh) || 0;
	const actualStr = prediction.inverter_real_time_kwh;

	if (actualStr === "N/A" || actualStr === null || actualStr === undefined || String(actualStr).trim() === "") {
		if (!state.offline_since) {
			state.offline_since = new Date();
		}

		addOrReplaceWindowRecord(state, {
			date,
			predicted_kwh: predictedKwh,
			actual_kwh: 0,
			difference_kwh: -predictedKwh,
			performance_percent: 0
		});

		let alert = await withSession(
			Alert.findOne({ user_id: user._id, status: { $ne: "RESOLVED" }, severity: "OFFLINE" }),
			session
		);

		const daysActive = getDaysActive(date, state.offline_since);

		if (!alert) {
			alert = new Alert({
				user_id: user._id,
				site_id: user.siteId || user._id.toString(),
				site_name: user.name,
				severity: "OFFLINE",
				status: "OPEN",
				predicted_kwh: predictedKwh,
				actual_kwh: 0,
				difference_kwh: -predictedKwh,
				performance_percent: 0,
				consecutive_days: daysActive
			});
			if (!previewMode) {
				await saveWithSession(alert, session);
				state.active_alert_id = alert._id;
				notificationActions.push({ type: "created", alert: alert.toObject() });
			}
			siteResult.alertsCreated += 1;
			siteResult.preview_payload = { 
				current_severity: "HEALTHY",
				predicted_kwh: predictedKwh,
				actual_kwh: 0,
				expected_action: "CREATE_ALERT", 
				expected_severity: "OFFLINE", 
				expected_performance: 0, 
				difference_kwh: -predictedKwh,
				consecutive_days: daysActive 
			};
		} else {
			alert.predicted_kwh = predictedKwh;
			alert.actual_kwh = 0;
			alert.difference_kwh = -predictedKwh;
			alert.performance_percent = 0;
			if (alert.consecutive_days !== daysActive) {
				alert.consecutive_days = daysActive;
				if (!previewMode) await saveWithSession(alert, session);
			}
			siteResult.preview_payload = { 
				current_severity: alert.severity,
				predicted_kwh: predictedKwh,
				actual_kwh: 0,
				expected_action: "UPDATE_ALERT", 
				expected_severity: "OFFLINE", 
				expected_performance: 0, 
				difference_kwh: -predictedKwh,
				consecutive_days: daysActive 
			};
		}

		if (!previewMode) {
			trimPerformanceWindow(state);
			state.last_evaluated_date = date;
			await finalizePredictionForEvaluation({ prediction, pipelineId, session });
			await saveWithSession(state, session);
		}
		return siteResult;
	}

	if (state.offline_since) {
		state.offline_since = null;
		const offlineAlert = await withSession(
			Alert.findOne({ user_id: user._id, status: { $ne: "RESOLVED" }, severity: "OFFLINE" }),
			session
		);
		if (offlineAlert) {
			await resolveAlert(offlineAlert, state, "System", { session, previewMode });
			siteResult.alertsResolved += 1;
		}
	}

	const actualKwh = Number(actualStr);

	if (!Number.isFinite(actualKwh)) {
		if (!previewMode) {
			state.last_evaluated_date = date;
			await finalizePredictionForEvaluation({ prediction, pipelineId, session });
			await saveWithSession(state, session);
		}
		siteResult.status = "skipped";
		siteResult.warnings.push({ userId: String(user._id), siteName: user.name, message: "INVALID_TELEMETRY_NON_NUMERIC" });
		return siteResult;
	}

	if (systemCapacity > 0 && actualKwh > maxValidGeneration) {
		if (!previewMode) {
			state.last_evaluated_date = date;
			await finalizePredictionForEvaluation({ prediction, pipelineId, session });
			await saveWithSession(state, session);
		}
		siteResult.status = "skipped";
		siteResult.warnings.push({
			userId: String(user._id),
			siteName: user.name,
			message: "INVALID_TELEMETRY_OVER_CAPACITY",
			actualKwh,
			maxValidGeneration
		});
		return siteResult;
	}

	let performancePercent = 0;
	if (predictedKwh > 0) {
		performancePercent = (actualKwh / predictedKwh) * 100;
	} else if (predictedKwh === 0 && actualKwh >= 0) {
		performancePercent = 100;
	}

	addOrReplaceWindowRecord(state, {
		date,
		predicted_kwh: predictedKwh,
		actual_kwh: actualKwh,
		difference_kwh: actualKwh - predictedKwh,
		performance_percent: performancePercent
	});

	let activeAlert = await withSession(
		Alert.findOne({ user_id: user._id, status: { $ne: "RESOLVED" }, severity: { $ne: "OFFLINE" } }),
		session
	);

	siteResult.preview_payload = {
		current_severity: activeAlert ? activeAlert.severity : "HEALTHY",
		predicted_kwh: predictedKwh,
		actual_kwh: actualKwh,
		expected_performance: Number(performancePercent.toFixed(1)),
		difference_kwh: Number((actualKwh - predictedKwh).toFixed(2)),
		consecutive_days: state.consecutive_underperformance_days
	};

	if (performancePercent >= UNDERPERFORMANCE_THRESHOLD) {
		state.consecutive_underperformance_days = 0;

		if (activeAlert) {
			await resolveAlert(activeAlert, state, "System", { session, previewMode });
			siteResult.alertsResolved += 1;
			siteResult.preview_payload.expected_action = "RESOLVE_ALERT";
			siteResult.preview_payload.expected_severity = "HEALTHY";
		} else {
			if (!previewMode) trimPerformanceWindow(state);
			siteResult.preview_payload.expected_action = "NO_ACTION";
			siteResult.preview_payload.expected_severity = "HEALTHY";
		}
	} else {
		state.consecutive_underperformance_days += 1;

		if (state.alert_cooldown_active && state.consecutive_underperformance_days >= 2) {
			state.alert_cooldown_active = false;
		}

		if (!state.alert_cooldown_active) {
			const recommendedSeverity = getSeverityForConsecutiveDays(state.consecutive_underperformance_days);

			if (recommendedSeverity) {
				if (!activeAlert) {
					activeAlert = new Alert({
						user_id: user._id,
						site_id: user.siteId || user._id.toString(),
						site_name: user.name,
						severity: recommendedSeverity,
						status: "OPEN",
						predicted_kwh: predictedKwh,
						actual_kwh: actualKwh,
						difference_kwh: actualKwh - predictedKwh,
						performance_percent: performancePercent,
						consecutive_days: state.consecutive_underperformance_days
					});
					if (!previewMode) {
						await saveWithSession(activeAlert, session);
						state.active_alert_id = activeAlert._id;
						notificationActions.push({ type: "created", alert: activeAlert.toObject() });
					}
					siteResult.alertsCreated += 1;
					siteResult.preview_payload.expected_action = "CREATE_ALERT";
					siteResult.preview_payload.expected_severity = recommendedSeverity;
				} else {
					const wasEscalated = await saveAlertWithSeverity({
						alert: activeAlert,
						newSeverity: recommendedSeverity,
						session,
						notificationActions,
						previewMode
					});
					activeAlert.predicted_kwh = predictedKwh;
					activeAlert.actual_kwh = actualKwh;
					activeAlert.difference_kwh = actualKwh - predictedKwh;
					activeAlert.performance_percent = performancePercent;
					activeAlert.consecutive_days = state.consecutive_underperformance_days;
					if (!previewMode) await saveWithSession(activeAlert, session);
					
					if (wasEscalated) {
						siteResult.alertsEscalated += 1;
						siteResult.preview_payload.expected_action = "UPGRADE_ALERT";
						siteResult.preview_payload.expected_severity = recommendedSeverity;
					} else {
						siteResult.preview_payload.expected_action = "UPDATE_ALERT";
						siteResult.preview_payload.expected_severity = activeAlert.severity;
					}
				}
			} else {
				siteResult.preview_payload.expected_action = "NO_ACTION";
				siteResult.preview_payload.expected_severity = activeAlert ? activeAlert.severity : "HEALTHY";
			}
		}

		if (!previewMode) trimPerformanceWindow(state);
	}

	if (!previewMode) {
		state.last_evaluated_date = date;
		await finalizePredictionForEvaluation({ prediction, pipelineId, session });
		await saveWithSession(state, session);
	}
	return siteResult;
};

const previewSiteEvaluation = async ({ user, date }) => {
	const pipelineId = "preview-" + Date.now();
	return await runWithOptionalTransaction(async (session) => {
		const result = await evaluateSite({
			user,
			date,
			pipelineId,
			session,
			forceReevaluate: true,
			previewMode: true
		});
		return result.preview_payload;
	});
};

const evaluateAllSites = async (options = {}) => {
	const date = normalizeDateString(options.date || getTodayDateString());
	const pipelineId = options.pipelineId || "";
	const summary = buildSummary({ date, pipelineId });
	console.log(`[SOIC Alert Engine] Starting daily evaluation for ${date} at ${new Date().toISOString()}`);

	const query = {
		isDeleted: { $ne: true },
		status: { $ne: "deleted" }
	};
	if (options.userId) query._id = options.userId;

	const activeUsers = await UserData.find(query);
	summary.sitesExpected = activeUsers.length;

	for (const user of activeUsers) {
		try {
			const siteResult = await runWithOptionalTransaction((session) => evaluateSite({
				user,
				date,
				pipelineId,
				session,
				forceReevaluate: Boolean(options.forceReevaluate)
			}));

			if (siteResult.status === "skipped") summary.sitesSkipped += 1;
			else summary.sitesProcessed += 1;

			summary.alertsCreated += siteResult.alertsCreated || 0;
			summary.alertsEscalated += siteResult.alertsEscalated || 0;
			summary.alertsResolved += siteResult.alertsResolved || 0;
			summary.warnings.push(...(siteResult.warnings || []));

			for (const action of siteResult.notificationActions || []) {
				if (action.type === "created") {
					await notificationService.notifyAlertCreated(action.alert);
					summary.notificationsSent += 1;
				} else if (action.type === "upgraded") {
					await notificationService.notifyAlertUpgraded(action.alert);
					summary.notificationsSent += 1;
				}
			}
		} catch (error) {
			summary.status = "FAILED";
			summary.sitesSkipped += 1;
			summary.failures.push({
				userId: String(user._id),
				siteName: user.name,
				message: error.message
			});
			console.error(`[SOIC Alert Engine] Failed evaluating site ${user.name || user._id}:`, error.message);
		}
	}

	console.log(`[SOIC Alert Engine] Daily evaluation completed for ${date}`);
	return summary;
};

module.exports = {
	evaluateAllSites,
	resolveAlert,
	previewSiteEvaluation,
	UNDERPERFORMANCE_THRESHOLD
};
