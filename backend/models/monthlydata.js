const mongoose = require("mongoose");

const forecastSchema = new mongoose.Schema(
	{
		date: { type: String, required: true },
		predicted_kwh: { type: Number, required: true },
		cloud_cover: { type: Number, required: true },
		temperature: { type: Number, required: true }
	},
	{ _id: false }
);

const monthlyDataSchema = new mongoose.Schema({
	userDataId: {
		type: mongoose.Schema.Types.ObjectId,
		ref: "UserData",
		required: true
	},
	annual_energy_kwh: { type: Number, required: true },
	monthly_energy_kwh: {
		Jan: { type: Number, required: true },
		Feb: { type: Number, required: true },
		Mar: { type: Number, required: true },
		Apr: { type: Number, required: true },
		May: { type: Number, required: true },
		Jun: { type: Number, required: true },
		Jul: { type: Number, required: true },
		Aug: { type: Number, required: true },
		Sep: { type: Number, required: true },
		Oct: { type: Number, required: true },
		Nov: { type: Number, required: true },
		Dec: { type: Number, required: true }
	},
	performance_ratio: { type: Number, required: true },
	forecast_7_days: {
		type: [forecastSchema],
		required: true,
		default: []
	}
});

module.exports = mongoose.model("MonthlyData", monthlyDataSchema);
