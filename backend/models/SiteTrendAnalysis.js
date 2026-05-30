const mongoose = require("mongoose");

const siteTrendAnalysisSchema = new mongoose.Schema(
{
user_id: { type: mongoose.Schema.Types.ObjectId, ref: "UserData", required: true, index: true },
analysis_period: { type: String, enum: ["7day", "30day", "90day"], required: true },
period_start_date: { type: String, required: true },
period_end_date: { type: String, required: true },
mean_performance: { type: Number, default: 0 },
std_dev: { type: Number, default: 0 },
slope: { type: Number, default: 0 },
intercept: { type: Number, default: 0 },
r_squared: { type: Number, default: 0 },
trend_direction: { type: String, enum: ["improving", "stable", "declining"], default: "stable" },
trend_severity: { type: String, enum: ["low", "medium", "high"], default: "low" },
projected_days_to_critical: { type: Number, default: null },
critical_threshold: { type: Number, default: 0.85 },
data_points: { type: Number, default: 0 },
missing_days: { type: Number, default: 0 },
quality_score: { type: Number, default: 0 },
calculated_at: { type: Date, default: Date.now }
},
{
collection: "site_trend_analysis",
timestamps: { createdAt: false, updatedAt: "updated_at" }
}
);

siteTrendAnalysisSchema.index({ user_id: 1, analysis_period: 1 }, { unique: true });

module.exports = mongoose.model("SiteTrendAnalysis", siteTrendAnalysisSchema);
