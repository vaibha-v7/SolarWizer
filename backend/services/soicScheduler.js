const cron = require("node-cron");
const { EventEmitter } = require("events");
const UserData = require("../models/data");
const { createOrUpdateSiteDailyPerformance } = require("./performanceRatioEngine");
const { evaluateAlertsForUser } = require("./alertEngine");
const { calculateHealthScore } = require("./healthScoreEngine");
const { calculateTrendAnalysis } = require("./trendAnalysisEngine");
const { calculateFleetMetrics } = require("./fleetIntelligenceEngine");
const { initializeOrUpdateBaseline, runQuarterlyBaselineReviews } = require("./baselineEngine");
const { enforceSoicRetention } = require("./soicRetentionEngine");

const alertEventEmitter = new EventEmitter();
let soicJob;

const runSoicPipeline = async (options = {}) => {
const query = options.userId ? { _id: options.userId } : {};
const users = await UserData.find(query).select("_id").lean();
if (!users.length) return { usersProcessed: 0 };

await createOrUpdateSiteDailyPerformance(options);

for (const user of users) {
await initializeOrUpdateBaseline(user._id);
await calculateTrendAnalysis(user._id);
await evaluateAlertsForUser(user._id);
await calculateHealthScore(user._id);
}

await calculateFleetMetrics();
await runQuarterlyBaselineReviews();
await enforceSoicRetention();

return { usersProcessed: users.length };
};

alertEventEmitter.on("daily:predictions:stored", async (eventPayload = {}) => {
try {
await runSoicPipeline();
console.log("[SOIC] Daily prediction event processed", eventPayload);
} catch (error) {
console.error("[SOIC] Event handling failure:", error.message);
}
});

const initializeSOICScheduler = () => {
if (soicJob) return soicJob;
soicJob = cron.schedule("0 20 * * *", () => runSoicPipeline().catch((err) => {
console.error("[SOIC] Scheduler execution failure:", err.message);
}), {
scheduled: true,
timezone: process.env.DAILY_PREDICTION_TIMEZONE || "Asia/Kolkata"
});
console.log("[SOIC] Scheduler initialized - runs daily at 8 PM");
return soicJob;
};

module.exports = {
alertEventEmitter,
runSoicPipeline,
initializeSOICScheduler
};
