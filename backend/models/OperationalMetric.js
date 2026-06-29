const mongoose = require("mongoose");

const operationalMetricSchema = new mongoose.Schema(
	{
		key: { type: String, required: true, unique: true, index: true },
		value: { type: mongoose.Schema.Types.Mixed, default: null },
		updated_at: { type: Date, default: Date.now }
	},
	{
		collection: "soic_operational_metrics"
	}
);

module.exports = mongoose.model("OperationalMetric", operationalMetricSchema);
