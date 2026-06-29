const mongoose = require("mongoose");

const positiveProductionEmailLogSchema = new mongoose.Schema(
	{
		userId: {
			type: mongoose.Schema.Types.ObjectId,
			ref: "UserData",
			required: true,
			index: true
		},
		dailyPredictionId: {
			type: mongoose.Schema.Types.ObjectId,
			ref: "DailyPrediction",
			default: null
		},
		date: {
			type: String,
			required: true,
			index: true
		},
		recipientEmail: {
			type: String,
			required: true,
			trim: true,
			lowercase: true
		},
		subject: {
			type: String,
			required: true
		},
		status: {
			type: String,
			enum: ["PROCESSING", "SENT", "FAILED"],
			default: "PROCESSING",
			index: true
		},
		predicted_kwh: {
			type: Number,
			default: null
		},
		actual_kwh: {
			type: Number,
			default: null
		},
		difference_kwh: {
			type: Number,
			default: null
		},
		projected_monthly_kwh: {
			type: Number,
			default: null
		},
		messageId: {
			type: String,
			default: ""
		},
		error: {
			type: String,
			default: ""
		},
		sentAt: {
			type: Date,
			default: null
		}
	},
	{ timestamps: true }
);

positiveProductionEmailLogSchema.index({ userId: 1, date: 1 }, { unique: true });

module.exports = mongoose.model("PositiveProductionEmailLog", positiveProductionEmailLogSchema);
