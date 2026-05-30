const mongoose = require("mongoose");

const dataQualityIssueSchema = new mongoose.Schema(
{
user_id: { type: mongoose.Schema.Types.ObjectId, ref: "UserData", required: true, index: true },
date: { type: String, required: true, index: true },
issue_type: { type: String, required: true },
severity: { type: String, enum: ["low", "medium", "high"], default: "low" },
description: { type: String, default: "" },
is_resolved: { type: Boolean, default: false },
resolved_at: { type: Date, default: null }
},
{
collection: "data_quality_issues",
timestamps: { createdAt: "created_at", updatedAt: "updated_at" }
}
);

module.exports = mongoose.model("DataQualityIssue", dataQualityIssueSchema);
