const mongoose = require("mongoose");

const pipelineRunSchema = new mongoose.Schema(
	{
		pipeline_id: { type: String, required: true, unique: true, index: true },
		pipeline_type: { type: String, required: true, index: true },
		source: { type: String, default: "" },
		status: {
			type: String,
			enum: ["RUNNING", "SUCCESS", "FAILED", "SKIPPED"],
			default: "RUNNING",
			index: true
		},
		business_date: { type: String, required: true, index: true },
		started_at: { type: Date, default: Date.now },
		ended_at: { type: Date, default: null },
		duration_ms: { type: Number, default: 0 },
		sites_expected: { type: Number, default: 0 },
		sites_processed: { type: Number, default: 0 },
		sites_skipped: { type: Number, default: 0 },
		alerts_created: { type: Number, default: 0 },
		alerts_escalated: { type: Number, default: 0 },
		alerts_resolved: { type: Number, default: 0 },
		notifications_sent: { type: Number, default: 0 },
		failures: { type: [mongoose.Schema.Types.Mixed], default: [] },
		warnings: { type: [mongoose.Schema.Types.Mixed], default: [] },
		stage_results: { type: mongoose.Schema.Types.Mixed, default: {} },
		metadata: { type: mongoose.Schema.Types.Mixed, default: {} }
	},
	{
		collection: "soic_pipeline_runs",
		timestamps: { createdAt: "created_at", updatedAt: "updated_at" }
	}
);

module.exports = mongoose.model("PipelineRun", pipelineRunSchema);
