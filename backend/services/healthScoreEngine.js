const Alert = require("../models/Alert");
const SiteDailyPerformance = require("../models/SiteDailyPerformance");
const SiteHealthScore = require("../models/SiteHealthScore");
const SiteHealthSnapshot = require("../models/SiteHealthSnapshot");
const SiteBaselineProfile = require("../models/SiteBaselineProfile");

const average = (values = []) => {
const nums = values.map(Number).filter(Number.isFinite);
if (!nums.length) return 0;
return nums.reduce((sum, val) => sum + val, 0) / nums.length;
};

const clamp = (value, min = 0, max = 100) => Math.max(min, Math.min(max, value));

const getHealthCategory = (score) => {
if (score >= 90) return "EXCELLENT";
if (score >= 80) return "HEALTHY";
if (score >= 70) return "MONITOR";
if (score >= 60) return "WARNING";
if (score >= 50) return "RISK";
return "CRITICAL";
};

const getTrendScore = (values = []) => {
if (values.length < 2) return 50;
const current = values[0];
const older = values[values.length - 1];
const change = current - older;
if (Math.abs(change) <= 0.01) return 90;
if (change > 0) return 95;
return change < -0.05 ? 55 : 80;
};

async function calculateHealthScore(userId) {
const history = await SiteDailyPerformance.find({ user_id: userId }).sort({ date: -1 }).limit(30).lean();
if (!history.length) return null;
const baseline = await SiteBaselineProfile.findOne({ user_id: userId }).lean();
const baselineRatio = Number(baseline?.baseline_performance_ratio || history[0]?.site_baseline_ratio || 0.9);

const accuracyValues = history.map((row) => 100 - Math.min(100, Math.abs(row.difference_percent || 0)));
const stabilityValues = history.map((row) => {
const ratio = Number(row.performance_ratio || 0);
if (!baselineRatio) return 70;
return 100 - Math.min(100, Math.abs((ratio - baselineRatio) / baselineRatio) * 100);
});
const communicationValues = history.map((row) => {
if (row.inverter_offline) return 0;
if (row.is_data_quality_issue) return 70;
if (row.data_source === "daily_prediction_inverter") return 100;
if (row.data_source === "daily_prediction_forecast") return 90;
if (row.data_source === "monthly_report_baseline") return 85;
return 80;
});
const trend7 = history.slice(0, 7).map((row) => row.performance_ratio);
const trend30 = history.slice(0, 30).map((row) => row.performance_ratio);

const activeAlerts = await Alert.find({ user_id: userId, status: { $in: ["CREATED", "ACTIVE", "ESCALATED"] } }).lean();
const p3AndAbove = activeAlerts.filter((alert) => ["P3", "P4", "P5"].includes(alert.priority)).length;
const penalty = activeAlerts.reduce((sum, alert) => {
if (alert.priority === "P5") return sum + 25;
if (alert.priority === "P4") return sum + 15;
if (alert.priority === "P3") return sum + 8;
if (alert.priority === "P2") return sum + 4;
if (alert.priority === "P1") return sum + 2;
return sum + 1;
}, 0);

const predictionAccuracyScore = clamp(average(accuracyValues));
const trend7DayScore = clamp(getTrendScore(trend7));
const trend30DayScore = clamp(getTrendScore(trend30));
const stabilityScore = clamp(average(stabilityValues));
const communicationReliability = clamp(average(communicationValues));

const weighted =
predictionAccuracyScore * 0.3 +
trend7DayScore * 0.2 +
trend30DayScore * 0.2 +
stabilityScore * 0.15 +
communicationReliability * 0.05;
const finalHealthScore = clamp(weighted - penalty);
const snapshotDate = history[0].date;
const payload = {
user_id: userId,
health_score: Number(finalHealthScore.toFixed(2)),
health_category: getHealthCategory(finalHealthScore),
prediction_accuracy_score: Number(predictionAccuracyScore.toFixed(2)),
trend_7day_score: Number(trend7DayScore.toFixed(2)),
trend_30day_score: Number(trend30DayScore.toFixed(2)),
stability_score: Number(stabilityScore.toFixed(2)),
communication_reliability: Number(communicationReliability.toFixed(2)),
active_alerts_penalty: penalty,
total_active_alerts: activeAlerts.length,
p3_and_above_count: p3AndAbove,
calculated_at: new Date(),
snapshot_date: snapshotDate
};

await SiteHealthScore.findOneAndUpdate({ user_id: userId }, payload, {
upsert: true,
returnDocument: "after"
});
await SiteHealthSnapshot.findOneAndUpdate(
{ user_id: userId, snapshot_date: snapshotDate },
payload,
{ upsert: true, returnDocument: "after" }
);

return payload;
}

module.exports = {
calculateHealthScore,
getHealthCategory
};
