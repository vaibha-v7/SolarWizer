const cron = require("node-cron");
const DailyPrediction = require("../models/DailyPrediction");
const { collectAndStoreDailyPredictions } = require("./predictionCollectionService");
const { sendPositiveProductionEmails } = require("./positiveProductionEmailService");
const { runDailyAlertEvaluation } = require("./soicAlertScheduler");
const { runSoicPipeline } = require("./soicScheduler");
const {
	appendStageResult,
	createPipelineId,
	finishPipelineRun,
	recordHealthMetric,
	startPipelineRun
} = require("./pipelineTelemetryService");
const { TIMEZONE, getTodayDateString, normalizeDateString } = require("../utils/dateUtils");

let dailyPredictionJob;

const buildPipelineFailure = (message, details = {}) => ({
	message,
	...details
});

async function fetchAndStoreDailyPredictions(options = {}) {
	return collectAndStoreDailyPredictions({
		...options,
		source: options.source || "daily_scheduler",
		sampleType: options.sampleType || "FINAL",
		activeOnly: options.activeOnly !== false,
		allowOverwriteFinalized: false
	});
}

async function runDailyPipeline(options = {}) {
	const businessDate = normalizeDateString(options.date || getTodayDateString());
	const pipelineId = options.pipelineId || createPipelineId("daily-pipeline");
	const failures = [];
	const warnings = [];

	await startPipelineRun({
		pipelineId,
		pipelineType: "daily_evaluation",
		source: options.source || "daily_scheduler",
		businessDate,
		metadata: {
			alertsAllowed: true
		}
	});

	await recordHealthMetric("pipeline_status", {
		status: "RUNNING",
		pipeline_id: pipelineId,
		business_date: businessDate,
		at: new Date().toISOString()
	});

	try {
		const predictionResult = await fetchAndStoreDailyPredictions({
			date: businessDate,
			pipelineId,
			source: "daily_scheduler",
			sampleType: "FINAL"
		});
		await appendStageResult(pipelineId, "prediction_generation", predictionResult);
		await recordHealthMetric("last_prediction_run", {
			pipeline_id: pipelineId,
			business_date: businessDate,
			at: new Date().toISOString(),
			stored: predictionResult.stored,
			updated: predictionResult.updated,
			skipped: predictionResult.skipped,
			failed: predictionResult.failed
		});

		if (!predictionResult.expectedSites) {
			failures.push(buildPipelineFailure("No expected sites discovered"));
		}

		if (predictionResult.failed > 0) {
			failures.push(buildPipelineFailure("Prediction generation had failures", {
				failed: predictionResult.failed,
				errors: predictionResult.errors
			}));
		}

		const storedForDate = await DailyPrediction.countDocuments({ date: businessDate });
		if (storedForDate < predictionResult.expectedSites) {
			failures.push(buildPipelineFailure("DailyPrediction validation failed before alert evaluation", {
				expected: predictionResult.expectedSites,
				storedForDate
			}));
		}

		if (failures.length) {
			await finishPipelineRun(pipelineId, {
				status: "FAILED",
				sites_expected: predictionResult.expectedSites,
				sites_processed: predictionResult.stored + predictionResult.updated,
				sites_skipped: predictionResult.skipped,
				failures,
				warnings
			});
			await recordHealthMetric("last_failed_pipeline", {
				pipeline_id: pipelineId,
				business_date: businessDate,
				at: new Date().toISOString(),
				failures
			});
			await recordHealthMetric("pipeline_status", {
				status: "FAILED",
				pipeline_id: pipelineId,
				business_date: businessDate,
				at: new Date().toISOString()
			});
			return {
				pipelineId,
				status: "FAILED",
				prediction: predictionResult,
				failures
			};
		}

		let positiveProductionEmails = null;
		if (process.env.POSITIVE_PRODUCTION_EMAILS_DISABLED !== "true") {
			try {
				positiveProductionEmails = await sendPositiveProductionEmails({ date: businessDate });
			} catch (emailError) {
				warnings.push(buildPipelineFailure("Positive production email notification failed", {
					message: emailError.message
				}));
			}
		}
		await appendStageResult(pipelineId, "positive_production_emails", positiveProductionEmails);

		const alertResult = await runDailyAlertEvaluation({
			date: businessDate,
			pipelineId,
			source: "daily_scheduler",
			allowBeforeCutoff: Boolean(options.allowBeforeCutoff)
		});
		await appendStageResult(pipelineId, "alert_evaluation", alertResult);

		if (alertResult.status === "FAILED") {
			await finishPipelineRun(pipelineId, {
				status: "FAILED",
				sites_expected: predictionResult.expectedSites,
				sites_processed: alertResult.sitesProcessed || 0,
				sites_skipped: alertResult.sitesSkipped || 0,
				alerts_created: alertResult.alertsCreated || 0,
				alerts_escalated: alertResult.alertsEscalated || 0,
				alerts_resolved: alertResult.alertsResolved || 0,
				notifications_sent: alertResult.notificationsSent || 0,
				failures: [...failures, ...(alertResult.failures || [])],
				warnings: [...warnings, ...(alertResult.warnings || [])]
			});
			await recordHealthMetric("last_failed_pipeline", {
				pipeline_id: pipelineId,
				business_date: businessDate,
				at: new Date().toISOString(),
				failures: alertResult.failures || []
			});
			return {
				pipelineId,
				status: "FAILED",
				prediction: predictionResult,
				alert: alertResult
			};
		}

		let performanceResult = null;
		if (alertResult.status === "SUCCESS" || alertResult.status === "SKIPPED") {
			try {
				performanceResult = await runSoicPipeline({
					date: businessDate,
					pipelineId,
					source: "daily_pipeline"
				});
				await recordHealthMetric("last_performance_run", {
					pipeline_id: pipelineId,
					business_date: businessDate,
					at: new Date().toISOString(),
					...performanceResult
				});
			} catch (performanceError) {
				warnings.push(buildPipelineFailure("SOIC performance pipeline failed", {
					message: performanceError.message
				}));
			}
		}
		await appendStageResult(pipelineId, "performance_pipeline", performanceResult);

		const finalStatus = alertResult.status === "SKIPPED" ? "SKIPPED" : "SUCCESS";
		await finishPipelineRun(pipelineId, {
			status: finalStatus,
			sites_expected: predictionResult.expectedSites,
			sites_processed: alertResult.sitesProcessed || 0,
			sites_skipped: alertResult.sitesSkipped || 0,
			alerts_created: alertResult.alertsCreated || 0,
			alerts_escalated: alertResult.alertsEscalated || 0,
			alerts_resolved: alertResult.alertsResolved || 0,
			notifications_sent: alertResult.notificationsSent || 0,
			failures,
			warnings: [...warnings, ...(alertResult.warnings || [])]
		});

		await recordHealthMetric("last_successful_pipeline", {
			pipeline_id: pipelineId,
			business_date: businessDate,
			at: new Date().toISOString(),
			status: finalStatus
		});
		await recordHealthMetric("pipeline_status", {
			status: finalStatus,
			pipeline_id: pipelineId,
			business_date: businessDate,
			at: new Date().toISOString()
		});

		return {
			pipelineId,
			status: finalStatus,
			prediction: predictionResult,
			alert: alertResult,
			performance: performanceResult,
			positiveProductionEmails,
			warnings
		};
	} catch (error) {
		const failure = buildPipelineFailure("Daily pipeline failed", { message: error.message });
		await finishPipelineRun(pipelineId, {
			status: "FAILED",
			failures: [failure],
			warnings
		});
		await recordHealthMetric("last_failed_pipeline", {
			pipeline_id: pipelineId,
			business_date: businessDate,
			at: new Date().toISOString(),
			failures: [failure]
		});
		await recordHealthMetric("pipeline_status", {
			status: "FAILED",
			pipeline_id: pipelineId,
			business_date: businessDate,
			at: new Date().toISOString()
		});
		throw error;
	}
}

function initializeDailyPredictionScheduler() {
	if (dailyPredictionJob) return dailyPredictionJob;

	dailyPredictionJob = cron.schedule("0 19 * * *", () => {
		runDailyPipeline().catch((error) => {
			console.error("[Daily Pipeline] Scheduler execution failure:", error.message);
		});
	}, {
		scheduled: true,
		timezone: TIMEZONE
	});

	recordHealthMetric("scheduler_status", {
		daily_prediction_scheduler: "RUNNING",
		alert_scheduler: "PIPELINE_GATED",
		soic_performance_scheduler: "PIPELINE_GATED",
		timezone: TIMEZONE,
		at: new Date().toISOString()
	});

	console.log(`[Daily Prediction] Scheduler initialized - runs daily at 7 PM ${TIMEZONE}`);
	return dailyPredictionJob;
}

module.exports = {
	initializeDailyPredictionScheduler,
	fetchAndStoreDailyPredictions,
	runDailyPipeline
};
