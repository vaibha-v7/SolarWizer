const mongoose = require("mongoose");
const UserData = require("../models/data");
const DailyPrediction = require("../models/DailyPrediction");
const Alert = require("../models/Alert");
const AlertHistory = require("../models/AlertHistory");
const SiteMonitoringState = require("../models/SiteMonitoringState");
const notificationService = require("./notificationService");

const getTodayDateString = () => {
	const today = new Date();
	const offset = today.getTimezoneOffset(); // returns in mins
	return new Date(today.getTime() - (offset * 60 * 1000)).toISOString().split("T")[0];
};

const generateIncidentId = () => {
	return `INC-${new Date().getFullYear()}-${Math.floor(Math.random() * 1000000).toString().padStart(6, '0')}`;
};

const resolveAlert = async (alert, state, resolvedBy = "System") => {
	alert.status = "RESOLVED";
	alert.resolved_at = new Date();
	alert.resolved_by = resolvedBy;
	await alert.save();

	const incident_start_date = new Date(alert.created_at).toISOString().split("T")[0];
	const incident_end_date = alert.resolved_at.toISOString().split("T")[0];

	// Log to permanent history ONLY upon resolution
	const history = new AlertHistory({
		user_id: alert.user_id,
		site_id: alert.site_id,
		site_name: alert.site_name,
		incident_id: generateIncidentId(),
		incident_start_date,
		incident_end_date,
		highest_severity_reached: alert.severity,
		total_days_active: alert.consecutive_days,
		status: "RESOLVED",
		performance_window: state.performance_window,
		notes: alert.notes,
		resolved_at: alert.resolved_at,
		resolved_by: alert.resolved_by
	});
	await history.save();

	// Performance Window Cleanup Rule - keep last 3 days
	if (state.performance_window.length > 3) {
		state.performance_window = state.performance_window.slice(-3);
	}
	state.consecutive_underperformance_days = 0;
	state.active_alert_id = null;
	state.alert_cooldown_active = true;
	await state.save();

	return alert;
};

const escalateAlert = async (alert, newSeverity) => {
	if (alert.severity !== newSeverity) {
		alert.severity = newSeverity;
		await alert.save();
		await notificationService.notifyAlertUpgraded(alert);
	}
};

const evaluateAllSites = async () => {
	console.log(`[SOIC Alert Engine] Starting daily evaluation at ${new Date().toISOString()}`);
	const todayStr = getTodayDateString();

	const activeUsers = await UserData.find({ isDeleted: { $ne: true }, status: { $ne: "deleted" } });

	for (const user of activeUsers) {
		const prediction = await DailyPrediction.findOne({ userId: user._id, date: todayStr }).lean();
		
		let state = await SiteMonitoringState.findOne({ user_id: user._id });
		if (!state) {
			state = new SiteMonitoringState({ user_id: user._id, performance_window: [] });
		}
		
		if (!prediction) {
			console.log(`[SOIC Alert Engine] PREDICTION_UNAVAILABLE for site ${user.name}`);
			continue;
		}

		const alreadyEvaluatedToday = (state.last_evaluated_date === todayStr);

		const systemCapacity = user.systemCapacity || 0;
		const maxValidGeneration = systemCapacity * 12;

		const predictedKwh = Number(prediction.predicted_kwh) || 0;
		const actualStr = prediction.inverter_real_time_kwh;
		
		if (actualStr === "N/A" || actualStr === null || actualStr === undefined || String(actualStr).trim() === "") {
			console.log(`[SOIC Alert Engine] Telemetry missing for ${user.name}. OFFLINE Alert.`);
			
			if (!state.offline_since) {
				state.offline_since = new Date();
			}

			const todayRecord = {
				date: todayStr,
				predicted_kwh: predictedKwh,
				actual_kwh: 0,
				difference_kwh: -predictedKwh,
				performance_percent: 0
			};
			const existingIdx = state.performance_window.findIndex(x => x.date === todayStr);
			if (existingIdx >= 0) {
				state.performance_window[existingIdx] = todayRecord;
			} else {
				state.performance_window.push(todayRecord);
			}
			state.performance_window.sort((a, b) => new Date(a.date) - new Date(b.date));

			let alert = await Alert.findOne({ user_id: user._id, status: { $ne: "RESOLVED" }, severity: "OFFLINE" });
			
			const msPerDay = 1000 * 60 * 60 * 24;
			const todayMs = new Date(todayStr).getTime();
			const offlineSinceMs = new Date(new Date(state.offline_since).toISOString().split("T")[0]).getTime();
			const daysActive = Math.floor((todayMs - offlineSinceMs) / msPerDay) + 1;

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
				await alert.save();
				state.active_alert_id = alert._id;
				await notificationService.notifyAlertCreated(alert);
			} else {
				alert.consecutive_days = daysActive;
				await alert.save();
			}

			if (state.active_alert_id) {
				if (state.performance_window.length > 30) state.performance_window = state.performance_window.slice(-30);
			} else {
				if (state.performance_window.length > 7) state.performance_window = state.performance_window.slice(-7);
			}

			state.last_evaluated_date = todayStr;
			await state.save();
			continue;
		} else {
			// Resolved offline if telemetry exists
			if (state.offline_since) {
				state.offline_since = null;
				const offlineAlert = await Alert.findOne({ user_id: user._id, status: { $ne: "RESOLVED" }, severity: "OFFLINE" });
				if (offlineAlert) {
					await resolveAlert(offlineAlert, state);
				}
			}
		}

		const actualKwh = Number(actualStr);
		
		if (!Number.isFinite(actualKwh)) {
			console.log(`[SOIC Alert Engine] INVALID_TELEMETRY (non-numeric) for site ${user.name}`);
			await state.save();
			continue;
		}

		if (systemCapacity > 0 && actualKwh > maxValidGeneration) {
			console.log(`[SOIC Alert Engine] INVALID_TELEMETRY for site ${user.name}: Actual ${actualKwh} > Capacity*12 (${maxValidGeneration})`);
			await state.save();
			continue;
		}

		let performancePercent = 0;
		if (predictedKwh > 0) {
			performancePercent = (actualKwh / predictedKwh) * 100;
		} else if (predictedKwh === 0 && actualKwh >= 0) {
			performancePercent = 100;
		}

		const todayRecord = {
			date: todayStr,
			predicted_kwh: predictedKwh,
			actual_kwh: actualKwh,
			difference_kwh: actualKwh - predictedKwh,
			performance_percent: performancePercent
		};
		const existingIdx = state.performance_window.findIndex(x => x.date === todayStr);
		if (existingIdx >= 0) {
			state.performance_window[existingIdx] = todayRecord;
		} else {
			state.performance_window.push(todayRecord);
		}
		state.performance_window.sort((a, b) => new Date(a.date) - new Date(b.date));

		let activeAlert = await Alert.findOne({ user_id: user._id, status: { $ne: "RESOLVED" }, severity: { $ne: "OFFLINE" } });

		if (performancePercent >= 90) {
			// Healthy
			state.consecutive_underperformance_days = 0;
			
			if (activeAlert) {
				await resolveAlert(activeAlert, state);
			} else {
				if (state.performance_window.length > 7) {
					state.performance_window = state.performance_window.slice(-7);
				}
			}
		} else {
			// Underperforming
			if (!alreadyEvaluatedToday) {
				state.consecutive_underperformance_days += 1;

				if (state.alert_cooldown_active && state.consecutive_underperformance_days >= 2) {
					state.alert_cooldown_active = false;
				}
			}

			if (!state.alert_cooldown_active) {
				let targetSeverity = null;
				if (state.consecutive_underperformance_days >= 10) targetSeverity = "CRITICAL";
				else if (state.consecutive_underperformance_days >= 7) targetSeverity = "RED";
				else if (state.consecutive_underperformance_days >= 5) targetSeverity = "ORANGE";
				else if (state.consecutive_underperformance_days >= 3) targetSeverity = "YELLOW";

				if (targetSeverity) {
					if (!activeAlert) {
						activeAlert = new Alert({
							user_id: user._id,
							site_id: user.siteId || user._id.toString(),
							site_name: user.name,
							severity: targetSeverity,
							status: "OPEN",
							predicted_kwh: predictedKwh,
							actual_kwh: actualKwh,
							difference_kwh: actualKwh - predictedKwh,
							performance_percent: performancePercent,
							consecutive_days: state.consecutive_underperformance_days
						});
						await activeAlert.save();
						state.active_alert_id = activeAlert._id;
						
						await notificationService.notifyAlertCreated(activeAlert);
					} else {
						activeAlert.predicted_kwh = predictedKwh;
						activeAlert.actual_kwh = actualKwh;
						activeAlert.difference_kwh = actualKwh - predictedKwh;
						activeAlert.performance_percent = performancePercent;
						activeAlert.consecutive_days = state.consecutive_underperformance_days;
						await escalateAlert(activeAlert, targetSeverity);
					}
				} else if (activeAlert) {
					activeAlert.predicted_kwh = predictedKwh;
					activeAlert.actual_kwh = actualKwh;
					activeAlert.difference_kwh = actualKwh - predictedKwh;
					activeAlert.performance_percent = performancePercent;
					activeAlert.consecutive_days = state.consecutive_underperformance_days;
					await activeAlert.save();
				}
			}

			// Trim window depending on state
			if (state.active_alert_id) {
				if (state.performance_window.length > 30) state.performance_window = state.performance_window.slice(-30);
			} else {
				if (state.performance_window.length > 7) state.performance_window = state.performance_window.slice(-7);
			}
		}

		state.last_evaluated_date = todayStr;
		await state.save();
	}

	console.log(`[SOIC Alert Engine] Daily evaluation completed.`);
};

module.exports = {
	evaluateAllSites,
	resolveAlert
};
