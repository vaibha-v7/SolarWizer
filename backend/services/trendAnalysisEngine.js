const SiteDailyPerformance = require("../models/SiteDailyPerformance");
const SiteTrendAnalysis = require("../models/SiteTrendAnalysis");
const calculateLinearRegression = require("../utils/calculateLinearRegression");
const calculateStdDev = require("../utils/calculateStdDev");

const average = (values = []) => {
const nums = values.map(Number).filter(Number.isFinite);
if (!nums.length) return 0;
return nums.reduce((sum, val) => sum + val, 0) / nums.length;
};

const getTrendDirection = (slope) => {
if (slope > 0.001) return "improving";
if (slope < -0.001) return "declining";
return "stable";
};

const getTrendSeverity = (slope) => {
const absolute = Math.abs(slope);
if (absolute > 0.01) return "high";
if (absolute > 0.005) return "medium";
return "low";
};

const analyzeWindow = async (userId, days, period) => {
const history = await SiteDailyPerformance.find({ user_id: userId }).sort({ date: -1 }).limit(days).lean();
const values = history.map((row) => row.performance_ratio).filter(Number.isFinite).reverse();
if (!values.length) return null;

const regression = calculateLinearRegression(values);
const criticalThreshold = 0.85;
const latest = values[values.length - 1];
let projectedDaysToCritical = null;
if (regression.slope < 0 && latest > criticalThreshold) {
projectedDaysToCritical = Math.max(0, Math.round((criticalThreshold - latest) / regression.slope));
}

const firstDate = history[history.length - 1]?.date || "";
const lastDate = history[0]?.date || "";

return SiteTrendAnalysis.findOneAndUpdate(
{ user_id: userId, analysis_period: period },
{
user_id: userId,
analysis_period: period,
period_start_date: firstDate,
period_end_date: lastDate,
mean_performance: Number(average(values).toFixed(4)),
std_dev: Number(calculateStdDev(values).toFixed(4)),
slope: Number(regression.slope.toFixed(6)),
intercept: Number(regression.intercept.toFixed(6)),
r_squared: Number(regression.r_squared.toFixed(4)),
trend_direction: getTrendDirection(regression.slope),
trend_severity: getTrendSeverity(regression.slope),
projected_days_to_critical: projectedDaysToCritical,
critical_threshold: criticalThreshold,
data_points: values.length,
missing_days: Math.max(0, days - values.length),
quality_score: Number((Math.max(0, 100 - (days - values.length) * 3)).toFixed(2)),
calculated_at: new Date()
},
{ upsert: true, returnDocument: "after" }
);
};

async function calculateTrendAnalysis(userId) {
const result = await Promise.all([
analyzeWindow(userId, 7, "7day"),
analyzeWindow(userId, 30, "30day"),
analyzeWindow(userId, 90, "90day")
]);
return result.filter(Boolean);
}

module.exports = {
calculateTrendAnalysis
};
