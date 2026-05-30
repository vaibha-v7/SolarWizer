const mongoose = require("mongoose");

const siteHealthSnapshotSchema = new mongoose.Schema(
{
user_id: { type: mongoose.Schema.Types.ObjectId, ref: "UserData", required: true, index: true },
snapshot_date: { type: String, required: true, index: true },
health_score: { type: Number, default: 0 },
health_category: { type: String, default: "CRITICAL" },
prediction_accuracy_score: { type: Number, default: 0 },
trend_7day_score: { type: Number, default: 0 },
trend_30day_score: { type: Number, default: 0 },
stability_score: { type: Number, default: 0 },
communication_reliability: { type: Number, default: 0 },
active_alerts_penalty: { type: Number, default: 0 },
total_active_alerts: { type: Number, default: 0 },
p3_and_above_count: { type: Number, default: 0 },
calculated_at: { type: Date, default: Date.now }
},
{
collection: "site_health_snapshots",
timestamps: { createdAt: false, updatedAt: "updated_at" }
}
);

siteHealthSnapshotSchema.index({ user_id: 1, snapshot_date: 1 }, { unique: true });

module.exports = mongoose.model("SiteHealthSnapshot", siteHealthSnapshotSchema);
