const mongoose = require("mongoose");

const siteMaintenanceContextSchema = new mongoose.Schema(
{
user_id: { type: mongoose.Schema.Types.ObjectId, ref: "UserData", required: true, index: true },
window_start: { type: Date, default: null },
window_end: { type: Date, default: null },
known_issue: { type: String, default: "" },
issue_status: { type: String, enum: ["open", "in_progress", "closed"], default: "open" },
notes: { type: String, default: "" }
},
{
collection: "site_maintenance_context",
timestamps: { createdAt: "created_at", updatedAt: "updated_at" }
}
);

module.exports = mongoose.model("SiteMaintenanceContext", siteMaintenanceContextSchema);
