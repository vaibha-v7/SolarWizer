const cron = require("node-cron");
const { evaluateAllSites } = require("./soicAlertEngine");

let alertJob;

const initializeSOICAlertScheduler = () => {
	if (alertJob) return alertJob;
	
	// Runs daily at 19:00 Local Time
	alertJob = cron.schedule("0 19 * * *", async () => {
		try {
			await evaluateAllSites();
		} catch (error) {
			console.error("[SOIC Alert Scheduler] Execution failure:", error.message);
		}
	}, {
		scheduled: true,
		timezone: process.env.DAILY_PREDICTION_TIMEZONE || "Asia/Kolkata"
	});
	
	console.log("[SOIC Alert Scheduler] Initialized - runs daily at 19:00");
	return alertJob;
};

module.exports = {
	initializeSOICAlertScheduler
};
