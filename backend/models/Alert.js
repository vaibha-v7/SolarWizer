const mongoose = require("mongoose");

const alertSchema = new mongoose.Schema(
	{
		user_id: { type: mongoose.Schema.Types.ObjectId, ref: "UserData", required: true, index: true },
		site_id: { type: String, required: true, index: true },
		site_name: { type: String, required: true },
		severity: { 
			type: String, 
			enum: ["YELLOW", "ORANGE", "RED", "CRITICAL", "OFFLINE"], 
			required: true,
			index: true
		},
		status: { 
			type: String, 
			enum: ["OPEN", "ACKNOWLEDGED", "RESOLVED"], 
			default: "OPEN",
			index: true
		},
		predicted_kwh: { type: Number, default: 0 },
		actual_kwh: { type: Number, default: 0 },
		difference_kwh: { type: Number, default: 0 },
		performance_percent: { type: Number, default: 0 },
		consecutive_days: { type: Number, default: 0 },
		notes: { type: String, default: "" },
		resolved_at: { type: Date, default: null },
		resolved_by: { type: String, default: "" }
	},
	{
		collection: "soic_alerts",
		timestamps: { createdAt: "created_at", updatedAt: "updated_at" }
	}
);

module.exports = mongoose.model("Alert", alertSchema);
