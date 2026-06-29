const { randomUUID } = require("crypto");
const PipelineRun = require("../models/PipelineRun");
const OperationalMetric = require("../models/OperationalMetric");
const { getTodayDateString } = require("../utils/dateUtils");

const createPipelineId = (prefix = "pipeline") => `${prefix}-${new Date().toISOString()}-${randomUUID()}`;

const safeLog = (level, message, details = {}) => {
	const payload = {
		at: new Date().toISOString(),
		...details
	};
	const line = `${message} ${JSON.stringify(payload)}`;
	if (level === "error") console.error(line);
	else if (level === "warn") console.warn(line);
	else console.log(line);
};

const startPipelineRun = async ({
	pipelineId = createPipelineId(),
	pipelineType,
	source = "",
	businessDate = getTodayDateString(),
	metadata = {}
}) => {
	safeLog("info", `[Pipeline:${pipelineType}] Started`, {
		pipeline_id: pipelineId,
		source,
		business_date: businessDate
	});

	try {
		await PipelineRun.findOneAndUpdate(
			{ pipeline_id: pipelineId },
			{
				pipeline_id: pipelineId,
				pipeline_type: pipelineType,
				source,
				status: "RUNNING",
				business_date: businessDate,
				started_at: new Date(),
				metadata
			},
			{ upsert: true, returnDocument: "after", setDefaultsOnInsert: true }
		);
	} catch (error) {
		console.error("[Pipeline Telemetry] Failed to start run:", error.message);
	}

	return pipelineId;
};

const finishPipelineRun = async (pipelineId, updates = {}) => {
	const endedAt = new Date();
	const run = await PipelineRun.findOne({ pipeline_id: pipelineId }).lean().catch(() => null);
	const durationMs = run?.started_at ? endedAt.getTime() - new Date(run.started_at).getTime() : 0;

	const payload = {
		...updates,
		ended_at: endedAt,
		duration_ms: durationMs
	};

	try {
		await PipelineRun.findOneAndUpdate({ pipeline_id: pipelineId }, payload, { returnDocument: "after" });
	} catch (error) {
		console.error("[Pipeline Telemetry] Failed to finish run:", error.message);
	}

	safeLog(updates.status === "FAILED" ? "error" : "info", `[Pipeline:${run?.pipeline_type || "unknown"}] Finished`, {
		pipeline_id: pipelineId,
		status: updates.status,
		duration_ms: durationMs
	});
};

const appendStageResult = async (pipelineId, stage, result) => {
	if (!pipelineId || !stage) return;
	try {
		await PipelineRun.findOneAndUpdate(
			{ pipeline_id: pipelineId },
			{ $set: { [`stage_results.${stage}`]: result } },
			{ returnDocument: "after" }
		);
	} catch (error) {
		console.error("[Pipeline Telemetry] Failed to append stage result:", error.message);
	}
};

const recordHealthMetric = async (key, value) => {
	try {
		await OperationalMetric.findOneAndUpdate(
			{ key },
			{ key, value, updated_at: new Date() },
			{ upsert: true, returnDocument: "after", setDefaultsOnInsert: true }
		);
	} catch (error) {
		console.error(`[Pipeline Telemetry] Failed to record metric ${key}:`, error.message);
	}
};

const getOperationalHealth = async () => {
	const [metrics, recentRuns] = await Promise.all([
		OperationalMetric.find().sort({ key: 1 }).lean(),
		PipelineRun.find().sort({ started_at: -1 }).limit(25).lean()
	]);

	return {
		metrics: metrics.reduce((acc, metric) => {
			acc[metric.key] = {
				value: metric.value,
				updated_at: metric.updated_at
			};
			return acc;
		}, {}),
		recent_runs: recentRuns
	};
};

module.exports = {
	createPipelineId,
	startPipelineRun,
	finishPipelineRun,
	appendStageResult,
	recordHealthMetric,
	getOperationalHealth,
	safeLog
};
