const mongoose = require("mongoose");

const userMonthlyProductionSchema = new mongoose.Schema(
	{
		userId: {
			type: mongoose.Schema.Types.ObjectId,
			ref: "UserData",
			required: true,
			index: true
		},
		year: {
			type: Number,
			required: true
		},
		month: {
			type: String, // "Jan", "Feb", ...
			required: true
		},
		predicted_kwh: {
			type: Number,
			default: 0
		},
		actual_kwh: {
			type: Number,
			default: 0
		},
		comparison: {
			type: String,
			default: "N/A"
		},
		daily_values: {
			type: Map,
			of: new mongoose.Schema(
				{
					actual_generation_kwh: { type: Number, default: 0 },
					predicted_generation_kwh: { type: Number, default: 0 }
				},
				{ _id: false }
			),
			default: {}
		}
	},
	{
		collection: "user_monthly_production",
		timestamps: { createdAt: "created_at", updatedAt: "updated_at" }
	}
);

userMonthlyProductionSchema.index({ userId: 1, year: 1, month: 1 }, { unique: true });

module.exports = mongoose.model("UserMonthlyProduction", userMonthlyProductionSchema);
