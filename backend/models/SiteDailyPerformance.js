const mongoose = require("mongoose");

const siteDailyPerformanceSchema = new mongoose.Schema(
{
user_id: { type: mongoose.Schema.Types.ObjectId, ref: "UserData", required: true, index: true },
date: { type: String, required: true, index: true },
predicted_generation_kwh: { type: Number, default: 0 },
actual_generation_kwh: { type: Number, default: 0 },
inverter_offline: { type: Boolean, default: false },
inverter_last_seen: { type: Date, default: null },
data_source: { type: String, default: "unknown", index: true },
data_sources: { type: [String], default: [] },
daily_prediction_id: { type: mongoose.Schema.Types.ObjectId, ref: "DailyPrediction", default: null },
monthly_report_id: { type: mongoose.Schema.Types.ObjectId, ref: "MonthlyData", default: null },
model_source: { type: String, default: "" },
difference_kwh: { type: Number, default: 0 },
difference_percent: { type: Number, default: 0 },
performance_ratio: { type: Number, default: 0 },
report_performance_ratio: { type: Number, default: 0 },
avg_temperature_c: { type: Number, default: 0 },
avg_cloud_cover_percent: { type: Number, default: 0 },
peak_ghi_w_per_m2: { type: Number, default: 0 },
peak_power_kw: { type: Number, default: 0 },
site_baseline_ratio: { type: Number, default: 0 },
baseline_drift_percent: { type: Number, default: 0 },
global_benchmark_ratio: { type: Number, default: 1 },
analytics_confidence: { type: Number, default: 0 },
reasoning_summary: { type: String, default: "" },
probable_causes: { type: [String], default: [] },
maintenance_recommendations: { type: [String], default: [] },
projected_risk_timeline_days: { type: Number, default: null },
is_anomaly: { type: Boolean, default: false },
anomaly_score: { type: Number, default: 0 },
is_suspicious: { type: Boolean, default: false },
is_data_quality_issue: { type: Boolean, default: false },
alert_triggered: { type: Boolean, default: false },
alert_types_triggered: { type: [String], default: [] }
},
{
collection: "site_daily_performance",
timestamps: { createdAt: "created_at", updatedAt: "updated_at" }
}
);

siteDailyPerformanceSchema.index({ user_id: 1, date: 1 }, { unique: true });
siteDailyPerformanceSchema.index({ user_id: 1, created_at: -1 });
siteDailyPerformanceSchema.index({ is_anomaly: 1, date: -1 });

module.exports = mongoose.model("SiteDailyPerformance", siteDailyPerformanceSchema);
