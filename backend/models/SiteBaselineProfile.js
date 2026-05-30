const mongoose = require("mongoose");

const siteBaselineProfileSchema = new mongoose.Schema(
{
user_id: { type: mongoose.Schema.Types.ObjectId, ref: "UserData", required: true, unique: true, index: true },
baseline_performance_ratio: { type: Number, default: 1 },
baseline_status: { type: String, enum: ["pending", "active", "review_due"], default: "pending" },
warning_threshold: { type: Number, default: 0.92 },
critical_threshold: { type: Number, default: 0.85 },
data_points_used: { type: Number, default: 0 },
confidence_level: { type: String, enum: ["low", "medium", "high"], default: "low" },
seasonal_profiles: {
winter: { type: Number, default: -5 },
summer: { type: Number, default: 3 },
monsoon: { type: Number, default: -8 }
},
initialized_at: { type: Date, default: null },
confirmed_at: { type: Date, default: null },
last_quarterly_review: { type: Date, default: null },
next_quarterly_review: { type: Date, default: null },
manual_override: { type: Boolean, default: false },
override_reason: { type: String, default: "" },
override_by: { type: String, default: "" },
override_at: { type: Date, default: null }
},
{
collection: "site_baseline_profiles",
timestamps: { createdAt: false, updatedAt: "updated_at" }
}
);

module.exports = mongoose.model("SiteBaselineProfile", siteBaselineProfileSchema);
