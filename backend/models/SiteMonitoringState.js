const mongoose = require("mongoose");

const siteMonitoringStateSchema = new mongoose.Schema(
	{
		user_id: { type: mongoose.Schema.Types.ObjectId, ref: "UserData", required: true, unique: true },
		consecutive_underperformance_days: { type: Number, default: 0 },
		alert_cooldown_active: { type: Boolean, default: false },
		last_evaluated_date: { type: String, default: "" }, // YYYY-MM-DD
		active_alert_id: { type: mongoose.Schema.Types.ObjectId, ref: "Alert", default: null },
		offline_since: { type: Date, default: null },
		performance_window: [{
			date: { type: String, required: true },
			predicted_kwh: { type: Number, required: true },
			actual_kwh: { type: Number, required: true },
			difference_kwh: { type: Number, required: true },
			performance_percent: { type: Number, required: true }
		}]
	},
	{
		collection: "soic_site_monitoring_states",
		timestamps: { createdAt: "created_at", updatedAt: "updated_at" }
	}
);

module.exports = mongoose.model("SiteMonitoringState", siteMonitoringStateSchema);
