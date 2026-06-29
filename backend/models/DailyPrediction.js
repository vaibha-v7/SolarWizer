const mongoose = require("mongoose");

const dailyPredictionSchema = new mongoose.Schema(
	{
		userId: {
			type: mongoose.Schema.Types.ObjectId,
			ref: "User",
			required: true,
			index: true
		},
		date: {
			type: String, // ISO date format: YYYY-MM-DD
			required: true,
			index: true
		},
		predicted_kwh: {
			type: Number,
			default: 0
		},
		peak_power_kw: {
			type: Number,
			default: 0
		},
		avg_temperature: {
			type: Number,
			default: 0
		},
		avg_cloud_cover: {
			type: Number,
			default: 0
		},
		inverter_real_time_kwh: {
			type: String,
			default: "N/A" // Placeholder for future inverter API integration
		},
		difference_kwh: {
			type: Number,
			default: null
		},
		comparison: {
			type: String,
			default: "N/A"
		},
		sample_type: {
			type: String,
			enum: ["INTRADAY", "FINAL"],
			default: "INTRADAY",
			index: true
		},
		source: {
			type: String,
			enum: ["manual_fetch", "daily_scheduler", "maintenance", "unknown"],
			default: "unknown",
			index: true
		},
		last_manual_fetch_at: {
			type: Date,
			default: null
		},
		last_scheduled_fetch_at: {
			type: Date,
			default: null
		},
		alert_evaluated_at: {
			type: Date,
			default: null,
			index: true
		},
		alert_evaluation_id: {
			type: String,
			default: "",
			index: true
		},
		finalized_at: {
			type: Date,
			default: null,
			index: true
		},
		createdAt: {
			type: Date,
			default: Date.now,
			index: true
		}
	},
	{ timestamps: true }
);

// One logical prediction per site per business date.
dailyPredictionSchema.index({ userId: 1, date: 1 }, { unique: true });
dailyPredictionSchema.index({ userId: 1, date: -1 });

module.exports = mongoose.model("DailyPrediction", dailyPredictionSchema);
