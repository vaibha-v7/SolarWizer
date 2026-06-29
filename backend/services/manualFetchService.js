const { collectAndStoreDailyPredictions } = require("./predictionCollectionService");
const {
	createPipelineId,
	finishPipelineRun,
	recordHealthMetric,
	startPipelineRun
} = require("./pipelineTelemetryService");
const { getTodayDateString } = require("../utils/dateUtils");

async function runManualPredictionFetch(options = {}) {
	const businessDate = options.date || getTodayDateString();
	const pipelineId = createPipelineId("manual-fetch");

	await startPipelineRun({
		pipelineId,
		pipelineType: "manual_fetch",
		source: "manual_fetch",
		businessDate,
		metadata: {
			userId: options.userId || null,
			alertsAllowed: false
		}
	});

	const result = await collectAndStoreDailyPredictions({
		...options,
		date: businessDate,
		source: "manual_fetch",
		sampleType: "INTRADAY",
		pipelineId,
		activeOnly: false,
		allowOverwriteFinalized: false
	});

	await recordHealthMetric("last_manual_fetch", {
		pipeline_id: pipelineId,
		business_date: businessDate,
		at: new Date().toISOString(),
		userId: options.userId || null,
		stored: result.stored,
		updated: result.updated,
		skipped: result.skipped,
		failed: result.failed
	});

	await finishPipelineRun(pipelineId, {
		status: result.failed > 0 && result.stored + result.updated === 0 ? "FAILED" : "SUCCESS",
		sites_expected: result.expectedSites,
		sites_processed: result.stored + result.updated,
		sites_skipped: result.skipped,
		failures: result.errors,
		warnings: [
			...result.warnings,
			{ message: "Alert evaluation skipped by design for manual fetch" }
		],
		stage_results: {
			manual_fetch: result,
			alert_evaluation: {
				skipped: true,
				reason: "Manual fetch is not allowed to change alert state"
			}
		}
	});

	return {
		...result,
		pipelineId,
		alertEvaluationSkipped: true,
		alertEvaluationSkipReason: "Manual fetch is not allowed to change alert state"
	};
}

module.exports = {
	runManualPredictionFetch
};
