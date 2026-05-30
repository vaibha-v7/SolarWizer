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
		createdAt: {
			type: Date,
			default: Date.now,
			index: true
		}
	},
	{ timestamps: true }
);

// Compound index for efficient queries
dailyPredictionSchema.index({ userId: 1, date: -1 });

module.exports = mongoose.model("DailyPrediction", dailyPredictionSchema);
