const mongoose = require("mongoose");

const alertAssignmentSchema = new mongoose.Schema(
{
alert_id: { type: mongoose.Schema.Types.ObjectId, ref: "Alert", required: true, index: true },
user_id: { type: mongoose.Schema.Types.ObjectId, ref: "UserData", required: true, index: true },
assigned_to: { type: String, required: true },
assigned_by: { type: String, default: "system" },
assigned_at: { type: Date, default: Date.now },
status: { type: String, enum: ["active", "completed"], default: "active" }
},
{
collection: "alert_assignments",
timestamps: { createdAt: "created_at", updatedAt: "updated_at" }
}
);

module.exports = mongoose.model("AlertAssignment", alertAssignmentSchema);
