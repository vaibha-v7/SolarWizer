const mongoose = require("mongoose");
const Alert = require("../models/Alert");
const UserData = require("../models/data");
const SiteHealthScore = require("../models/SiteHealthScore");
const FleetPerformanceMetrics = require("../models/FleetPerformanceMetrics");
const SiteDailyPerformance = require("../models/SiteDailyPerformance");
const SiteTrendAnalysis = require("../models/SiteTrendAnalysis");
const { runSoicPipeline } = require("../services/soicScheduler");

let hydrationPromise = null;
let lastHydratedAt = 0;
const HYDRATION_TTL_MS = 5 * 60 * 1000;

const hydrateSoicAnalytics = async ({ force = false } = {}) => {
const now = Date.now();
if (!force && now - lastHydratedAt < HYDRATION_TTL_MS) return null;
if (!force) {
const latestMetrics = await FleetPerformanceMetrics.findOne().sort({ snapshot_date: -1 }).select("calculated_at").lean();
const latestCalculatedAt = latestMetrics?.calculated_at ? new Date(latestMetrics.calculated_at).getTime() : 0;
if (latestCalculatedAt && now - latestCalculatedAt < HYDRATION_TTL_MS) {
lastHydratedAt = now;
return null;
}
}
if (!hydrationPromise) {
hydrationPromise = runSoicPipeline()
.then((result) => {
lastHydratedAt = Date.now();
return result;
})
.finally(() => {
hydrationPromise = null;
});
}
return hydrationPromise;
};

const respondError = (res, message, error, status = 500) => res.status(status).json({
success: false,
message,
error: error?.message || String(error || "Unknown error")
});

const enrichWithUserName = async (records = []) => {
const userIds = [...new Set(records
.map((record) => String(record?.user_id || ""))
.filter((id) => mongoose.Types.ObjectId.isValid(id)))];

if (!userIds.length) return records;

const users = await UserData.find({ _id: { $in: userIds } }).select("_id name").lean();
const namesById = new Map(users.map((user) => [String(user._id), user.name]));

return records.map((record) => ({
...record,
user_name: namesById.get(String(record.user_id)) || record.user_name || ""
}));
};

const getAlerts = async (req, res) => {
try {
await hydrateSoicAnalytics();
const alerts = await Alert.find().sort({ created_at: -1 }).lean();
const alertsWithNames = await enrichWithUserName(alerts);
return res.status(200).json({ success: true, data: alertsWithNames });
} catch (error) {
return respondError(res, "Failed to fetch alerts", error);
}
};

const getUserAlerts = async (req, res) => {
try {
const { userId } = req.params;
if (!mongoose.Types.ObjectId.isValid(userId)) {
return res.status(400).json({ success: false, message: "Invalid user id" });
}
const alerts = await Alert.find({ user_id: userId }).sort({ created_at: -1 }).lean();
const alertsWithNames = await enrichWithUserName(alerts);
return res.status(200).json({ success: true, data: alertsWithNames });
} catch (error) {
return respondError(res, "Failed to fetch user alerts", error);
}
};

const getActiveAlerts = async (req, res) => {
try {
await hydrateSoicAnalytics();
const alerts = await Alert.find({ status: { $in: ["CREATED", "ACTIVE", "ESCALATED"] } })
.sort({ priority: -1, triggered_at: -1, created_at: -1 })
.lean();
const alertsWithNames = await enrichWithUserName(alerts);
return res.status(200).json({ success: true, data: alertsWithNames });
} catch (error) {
return respondError(res, "Failed to fetch active alerts", error);
}
};

const getAlertsByPriority = async (req, res) => {
try {
const { priority } = req.params;
const alerts = await Alert.find({ priority }).sort({ created_at: -1 }).lean();
const alertsWithNames = await enrichWithUserName(alerts);
return res.status(200).json({ success: true, data: alertsWithNames });
} catch (error) {
return respondError(res, "Failed to fetch alerts by priority", error);
}
};

const getHealthScores = async (req, res) => {
try {
await hydrateSoicAnalytics();
const scores = await SiteHealthScore.find().sort({ health_score: -1 }).lean();
return res.status(200).json({ success: true, data: scores });
} catch (error) {
return respondError(res, "Failed to fetch health scores", error);
}
};

const getUserHealthScore = async (req, res) => {
try {
const { userId } = req.params;
if (!mongoose.Types.ObjectId.isValid(userId)) {
return res.status(400).json({ success: false, message: "Invalid user id" });
}
const score = await SiteHealthScore.findOne({ user_id: userId }).lean();
return res.status(200).json({ success: true, data: score });
} catch (error) {
return respondError(res, "Failed to fetch user health score", error);
}
};

const getFleetMetrics = async (req, res) => {
try {
await hydrateSoicAnalytics();
const metrics = await FleetPerformanceMetrics.findOne().sort({ snapshot_date: -1 }).lean();
return res.status(200).json({ success: true, data: metrics });
} catch (error) {
return respondError(res, "Failed to fetch fleet metrics", error);
}
};

const getSitePerformance = async (req, res) => {
try {
const { userId } = req.params;
if (!mongoose.Types.ObjectId.isValid(userId)) {
return res.status(400).json({ success: false, message: "Invalid user id" });
}
const performance = await SiteDailyPerformance.find({ user_id: userId }).sort({ date: -1 }).lean();
return res.status(200).json({ success: true, data: performance });
} catch (error) {
return respondError(res, "Failed to fetch site performance", error);
}
};

const getSiteTrends = async (req, res) => {
try {
const { userId } = req.params;
if (!mongoose.Types.ObjectId.isValid(userId)) {
return res.status(400).json({ success: false, message: "Invalid user id" });
}
const trends = await SiteTrendAnalysis.find({ user_id: userId }).sort({ analysis_period: 1 }).lean();
return res.status(200).json({ success: true, data: trends });
} catch (error) {
return respondError(res, "Failed to fetch trend analysis", error);
}
};

const getWatchlist = async (req, res) => {
try {
await hydrateSoicAnalytics();
const rows = await SiteDailyPerformance.find().sort({ user_id: 1, date: -1 }).lean();
const latestByUser = new Map();
for (const row of rows) {
const key = String(row.user_id);
if (!latestByUser.has(key)) latestByUser.set(key, row);
}
const watchlist = Array.from(latestByUser.values())
.filter((row) => {
const baseline = Number(row.site_baseline_ratio || 0);
if (!baseline) return row.performance_ratio >= 0.88 && row.performance_ratio < 0.95;
return row.performance_ratio < baseline * 0.98 && row.performance_ratio >= baseline * 0.85;
})
.sort((left, right) => left.performance_ratio - right.performance_ratio)
.slice(0, 50);
return res.status(200).json({ success: true, data: watchlist });
} catch (error) {
return respondError(res, "Failed to fetch watchlist", error);
}
};

const getDashboard = async (req, res) => {
try {
await hydrateSoicAnalytics({ force: req.query.refresh === "true" });
const [metrics, activeAlerts, alerts, healthScores] = await Promise.all([
FleetPerformanceMetrics.findOne().sort({ snapshot_date: -1 }).lean(),
Alert.find({ status: { $in: ["CREATED", "ACTIVE", "ESCALATED"] } })
.sort({ priority: -1, triggered_at: -1, created_at: -1 })
.lean(),
Alert.find().sort({ triggered_at: -1, created_at: -1 }).lean(),
SiteHealthScore.find().sort({ health_score: -1 }).lean()
]);

const [activeAlertsWithNames, alertsWithNames] = await Promise.all([
enrichWithUserName(activeAlerts),
enrichWithUserName(alerts)
]);

const rows = await SiteDailyPerformance.find().sort({ user_id: 1, date: -1 }).lean();
const latestByUser = new Map();
for (const row of rows) {
const key = String(row.user_id);
if (!latestByUser.has(key)) latestByUser.set(key, row);
}
const watchlist = Array.from(latestByUser.values())
.filter((row) => {
const baseline = Number(row.site_baseline_ratio || 0);
if (!baseline) return row.performance_ratio >= 0.88 && row.performance_ratio < 0.95;
return row.performance_ratio < baseline * 0.98 && row.performance_ratio >= baseline * 0.85;
})
.sort((left, right) => left.performance_ratio - right.performance_ratio)
.slice(0, 50);

return res.status(200).json({
success: true,
data: {
metrics,
activeAlerts: activeAlertsWithNames,
alerts: alertsWithNames,
healthScores,
watchlist
}
});
} catch (error) {
return respondError(res, "Failed to fetch SOIC dashboard", error);
}
};

const acknowledgeAlert = async (req, res) => {
try {
const { alertId } = req.params;
if (!mongoose.Types.ObjectId.isValid(alertId)) {
return res.status(400).json({ success: false, message: "Invalid alert id" });
}
const alert = await Alert.findByIdAndUpdate(
alertId,
{ status: "ACTIVE" },
{ returnDocument: "after" }
).lean();
return res.status(200).json({ success: true, data: alert });
} catch (error) {
return respondError(res, "Failed to acknowledge alert", error);
}
};

const resolveAlert = async (req, res) => {
try {
const { alertId } = req.params;
const { reason = "Resolved by operator", notes = "", resolvedBy = "operator" } = req.body || {};
if (!mongoose.Types.ObjectId.isValid(alertId)) {
return res.status(400).json({ success: false, message: "Invalid alert id" });
}
const alert = await Alert.findByIdAndUpdate(
alertId,
{
status: "RESOLVED",
resolved_at: new Date(),
resolution_reason: String(reason),
resolution_notes: String(notes),
resolved_by: String(resolvedBy)
},
{ returnDocument: "after" }
).lean();
return res.status(200).json({ success: true, data: alert });
} catch (error) {
return respondError(res, "Failed to resolve alert", error);
}
};

module.exports = {
getAlerts,
getUserAlerts,
getActiveAlerts,
getAlertsByPriority,
getHealthScores,
getUserHealthScore,
getFleetMetrics,
getSitePerformance,
getSiteTrends,
getWatchlist,
getDashboard,
acknowledgeAlert,
resolveAlert
};
