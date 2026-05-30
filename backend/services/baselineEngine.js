const SiteDailyPerformance = require("../models/SiteDailyPerformance");
const SiteBaselineProfile = require("../models/SiteBaselineProfile");

const average = (values = []) => {
const nums = values.map(Number).filter(Number.isFinite);
if (!nums.length) return 0;
return nums.reduce((sum, n) => sum + n, 0) / nums.length;
};

const getConfidence = (count) => {
if (count >= 90) return "high";
if (count >= 45) return "medium";
return "low";
};

async function initializeOrUpdateBaseline(userId) {
const history = await SiteDailyPerformance.find({ user_id: userId }).sort({ date: -1 }).limit(30).lean();
const ratios = history.map((item) => item.performance_ratio).filter(Number.isFinite);
const dataPoints = ratios.length;
const baselineRatio = average(ratios) || 1;
const now = new Date();
const quarterLater = new Date(now);
quarterLater.setDate(quarterLater.getDate() + 90);

const profile = await SiteBaselineProfile.findOne({ user_id: userId });
const adjustedRatio = profile?.manual_override
? profile.baseline_performance_ratio
: Number(baselineRatio.toFixed(4));

return SiteBaselineProfile.findOneAndUpdate(
{ user_id: userId },
{
user_id: userId,
baseline_performance_ratio: adjustedRatio,
baseline_status: dataPoints >= 7 ? "active" : "pending",
warning_threshold: Number((adjustedRatio * 0.92).toFixed(4)),
critical_threshold: Number((adjustedRatio * 0.85).toFixed(4)),
data_points_used: dataPoints,
confidence_level: getConfidence(dataPoints),
seasonal_profiles: { winter: -5, summer: 3, monsoon: -8 },
initialized_at: profile?.initialized_at || (dataPoints >= 7 ? now : null),
confirmed_at: dataPoints >= 7 ? now : profile?.confirmed_at,
last_quarterly_review: now,
next_quarterly_review: quarterLater
},
{ upsert: true, returnDocument: "after" }
);
}

async function runQuarterlyBaselineReviews() {
const dueProfiles = await SiteBaselineProfile.find({
next_quarterly_review: { $lte: new Date() }
}).select("user_id").lean();
for (const profile of dueProfiles) {
await initializeOrUpdateBaseline(profile.user_id);
}
return { reviewed: dueProfiles.length };
}

module.exports = {
initializeOrUpdateBaseline,
runQuarterlyBaselineReviews
};
