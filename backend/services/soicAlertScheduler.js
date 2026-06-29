const DailyPrediction = require("../models/DailyPrediction");
const SiteMonitoringState = require("../models/SiteMonitoringState");
const UserData = require("../models/data");
const { evaluateAllSites } = require("./soicAlertEngine");
const {
	createPipelineId,
	recordHealthMetric,
	safeLog
} = require("./pipelineTelemetryService");
const {
	TIMEZONE,
	getTodayDateString,
	isEvaluationCutoffReached,
	normalizeDateString
} = require("../utils/dateUtils");

const hasStoredInverterValue = (prediction) => (
	prediction &&
	prediction.inverter_real_time_kwh !== null &&
	prediction.inverter_real_time_kwh !== undefined &&
	String(prediction.inverter_real_time_kwh).trim() !== ""
);

const getActiveUsers = (userId) => {
	const query = {
		isDeleted: { $ne: true },
		status: { $ne: "deleted" }
	};
	if (userId) query._id = userId;
	return UserData.find(query).select("_id name").lean();
};

async function validateDailyEvaluationReadiness(options = {}) {
	const date = normalizeDateString(options.date || getTodayDateString());
	const failures = [];
	const warnings = [];
	const users = await getActiveUsers(options.userId);
	const userIds = users.map((user) => user._id);

	if (!users.length) {
		failures.push({ message: "Expected sites discovery returned zero sites" });
	}

	if (!options.allowBeforeCutoff && !isEvaluationCutoffReached({ date })) {
		failures.push({
			message: "Alert evaluation blocked before configured cutoff",
			date,
			timezone: TIMEZONE
		});
	}

	const [predictions, states] = await Promise.all([
		userIds.length
			? DailyPrediction.find({ userId: { $in: userIds }, date }).lean()
			: [],
		userIds.length
			? SiteMonitoringState.find({ user_id: { $in: userIds } }).lean()
			: []
	]);

	const predictionsByUser = new Map(predictions.map((prediction) => [String(prediction.userId), prediction]));
	const statesByUser = new Map(states.map((state) => [String(state.user_id), state]));
	const missingPredictions = [];
	const missingFinalTelemetry = [];
	let alreadyEvaluated = 0;

	for (const user of users) {
		const userKey = String(user._id);
		const prediction = predictionsByUser.get(userKey);
		if (!prediction) {
			missingPredictions.push({ userId: userKey, siteName: user.name });
			continue;
		}

		if (!hasStoredInverterValue(prediction)) {
			missingFinalTelemetry.push({ userId: userKey, siteName: user.name });
		}

		const state = statesByUser.get(userKey);
		if (state?.last_evaluated_date === date || prediction.alert_evaluated_at) {
			alreadyEvaluated += 1;
		}
	}

	if (missingPredictions.length) {
		failures.push({
			message: "DailyPrediction records missing for business date",
			missingPredictions
		});
	}

	if (missingFinalTelemetry.length) {
		failures.push({
			message: "Stored final inverter values are unavailable for one or more sites",
			missingFinalTelemetry
		});
	}

	if (users.length && alreadyEvaluated === users.length) {
		warnings.push({
			message: "All expected sites were already evaluated for this business date",
			date
		});
	}

	return {
		canEvaluate: failures.length === 0 && alreadyEvaluated < users.length,
		duplicateComplete: users.length > 0 && alreadyEvaluated === users.length,
		date,
		sitesExpected: users.length,
		predictionsFound: predictions.length,
		alreadyEvaluated,
		failures,
		warnings
	};
}

async function runDailyAlertEvaluation(options = {}) {
	const date = normalizeDateString(options.date || getTodayDateString());
	const pipelineId = options.pipelineId || createPipelineId("alert-evaluation");
	const source = options.source || "alert_scheduler";

	safeLog("info", "[SOIC Alert Scheduler] Evaluation requested", {
		pipeline_id: pipelineId,
		source,
		business_date: date
	});

	const readiness = await validateDailyEvaluationReadiness({
		date,
		userId: options.userId,
		allowBeforeCutoff: Boolean(options.allowBeforeCutoff)
	});

	if (readiness.duplicateComplete) {
		await recordHealthMetric("last_alert_evaluation", {
			pipeline_id: pipelineId,
			business_date: date,
			status: "SKIPPED",
			reason: "duplicate_evaluation",
			at: new Date().toISOString()
		});
		return {
			status: "SKIPPED",
			reason: "duplicate_evaluation",
			pipelineId,
			businessDate: date,
			sitesExpected: readiness.sitesExpected,
			sitesProcessed: 0,
			sitesSkipped: readiness.sitesExpected,
			failures: [],
			warnings: readiness.warnings
		};
	}

	if (!readiness.canEvaluate) {
		await recordHealthMetric("last_alert_evaluation", {
			pipeline_id: pipelineId,
			business_date: date,
			status: "FAILED",
			failures: readiness.failures,
			at: new Date().toISOString()
		});
		safeLog("warn", "[SOIC Alert Scheduler] Evaluation blocked", {
			pipeline_id: pipelineId,
			business_date: date,
			failures: readiness.failures
		});
		return {
			status: "FAILED",
			reason: "validation_failed",
			pipelineId,
			businessDate: date,
			sitesExpected: readiness.sitesExpected,
			sitesProcessed: 0,
			sitesSkipped: readiness.sitesExpected,
			failures: readiness.failures,
			warnings: readiness.warnings
		};
	}

	try {
		const result = await evaluateAllSites({
			date,
			userId: options.userId,
			pipelineId,
			source
		});

		await recordHealthMetric("last_alert_evaluation", {
			pipeline_id: pipelineId,
			business_date: date,
			status: result.status,
			at: new Date().toISOString(),
			sitesProcessed: result.sitesProcessed,
			sitesSkipped: result.sitesSkipped,
			alertsCreated: result.alertsCreated,
			alertsEscalated: result.alertsEscalated,
			alertsResolved: result.alertsResolved
		});

		return result;
	} catch (error) {
		await recordHealthMetric("last_alert_evaluation", {
			pipeline_id: pipelineId,
			business_date: date,
			status: "FAILED",
			failures: [{ message: error.message }],
			at: new Date().toISOString()
		});
		return {
			status: "FAILED",
			reason: "alert_engine_failed",
			pipelineId,
			businessDate: date,
			sitesExpected: readiness.sitesExpected,
			sitesProcessed: 0,
			sitesSkipped: readiness.sitesExpected,
			failures: [{ message: error.message }],
			warnings: readiness.warnings
		};
	}
}

module.exports = {
	runDailyAlertEvaluation,
	validateDailyEvaluationReadiness
};
