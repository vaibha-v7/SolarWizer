const mongoose = require("mongoose");

const alertSchema = new mongoose.Schema(
{
user_id: { type: mongoose.Schema.Types.ObjectId, ref: "UserData", required: true, index: true },
alert_type: { type: String, required: true },
priority: { type: String, enum: ["P0", "P1", "P2", "P3", "P4", "P5"], default: "P0", index: true },
title: { type: String, required: true },
description: { type: String, default: "" },
short_message: { type: String, default: "" },
confidence_score: { type: Number, default: 0 },
confidence_distribution: { type: Object, default: {} },
status: { type: String, enum: ["CREATED", "ACTIVE", "ESCALATED", "RESOLVED", "AUTO_RESOLVED"], default: "CREATED", index: true },
triggered_at: { type: Date, default: Date.now },
resolved_at: { type: Date, default: null },
auto_resolved_at: { type: Date, default: null },
days_active: { type: Number, default: 0 },
escalation_count: { type: Number, default: 0 },
escalation_history: { type: [Object], default: [] },
baseline_performance: { type: Number, default: 0 },
actual_performance: { type: Number, default: 0 },
variance_from_baseline: { type: Number, default: 0 },
consecutive_days_triggered: { type: Number, default: 0 },
resolved_by: { type: String, default: "" },
resolution_reason: { type: String, default: "" },
resolution_notes: { type: String, default: "" },
possible_causes: { type: [String], default: [] },
maintenance_recommendations: { type: [String], default: [] },
projected_risk_timeline_days: { type: Number, default: null },
reasoning_summary: { type: String, default: "" },
data_sources: { type: [String], default: [] },
assigned_to: { type: String, default: "" },
assigned_at: { type: Date, default: null },
is_customer_visible: { type: Boolean, default: true },
is_ignored: { type: Boolean, default: false },
ignore_reason: { type: String, default: "" },
customer_notified: { type: Boolean, default: false },
customer_notified_at: { type: Date, default: null }
},
{
collection: "alerts",
timestamps: { createdAt: "created_at", updatedAt: "updated_at" }
}
);

alertSchema.index({ user_id: 1, created_at: -1 });
alertSchema.index({ status: 1, priority: 1, created_at: -1 });
alertSchema.index({ priority: 1, created_at: -1 });
alertSchema.index({ user_id: 1, alert_type: 1, triggered_at: 1 }, { unique: true });

module.exports = mongoose.model("Alert", alertSchema);
