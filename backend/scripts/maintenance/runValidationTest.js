const mongoose = require("mongoose");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../../.env") });

const Alert = require("../../models/Alert");
const AlertHistory = require("../../models/AlertHistory");
const SiteMonitoringState = require("../../models/SiteMonitoringState");
const DailyPrediction = require("../../models/DailyPrediction");
const UserData = require("../../models/data");
const { runDailyAlertEvaluation } = require("../../services/soicAlertScheduler");
const { getTodayDateString } = require("../../utils/dateUtils");

async function main() {
	console.log("=== STARTING VALIDATION CYCLE ===");
	const uri = process.env.MONGO_DB_URI || process.env.MONGO_URI;
	await mongoose.connect(uri);
	console.log("Database connected.\n");

	const today = getTodayDateString();

	console.log("1. Checking Initial DailyPrediction State...");
	const totalPreds = await DailyPrediction.countDocuments();
	const lockedPreds = await DailyPrediction.countDocuments({
		$or: [
			{ alert_evaluated_at: { $exists: true, $ne: null } },
			{ alert_evaluation_id: { $exists: true, $ne: "" } },
			{ finalized_at: { $exists: true, $ne: null } }
		]
	});
	console.log(`Total Predictions: ${totalPreds}`);
	console.log(`Locked Predictions: ${lockedPreds}\n`);

	console.log("2. Running Alert Evaluation Pipeline for", today, "...");
	const result = await runDailyAlertEvaluation({
		date: today,
		allowBeforeCutoff: true,
		source: "manual_validation"
	});

	console.log("Evaluation Result:");
	console.log(JSON.stringify(result, null, 2));

	console.log("\n3. Post-Evaluation Validation Checks:");

	// Connected Sites vs Active Alerts
	const activeUsers = await UserData.countDocuments({ isDeleted: { $ne: true }, status: { $ne: "deleted" } });
	const activeAlerts = await Alert.countDocuments({ status: { $ne: "RESOLVED" } });
	const criticalAlerts = await Alert.countDocuments({ status: { $ne: "RESOLVED" }, severity: "CRITICAL" });
	const statesCount = await SiteMonitoringState.countDocuments();
	const historyCount = await AlertHistory.countDocuments();

	console.log(`Connected Sites (Active Users): ${activeUsers}`);
	console.log(`Active Alerts: ${activeAlerts}`);
	console.log(`Critical Alerts: ${criticalAlerts}`);
	console.log(`SiteMonitoringState Documents: ${statesCount}`);
	console.log(`AlertHistory Documents: ${historyCount}`);

	// Check orphans
	const alerts = await Alert.find({ status: { $ne: "RESOLVED" } }).lean();
	let orphanCount = 0;
	for (const alert of alerts) {
		const user = await UserData.findById(alert.user_id);
		if (!user || user.isDeleted || user.status === "deleted") {
			orphanCount++;
		}
	}
	console.log(`Orphan Alerts: ${orphanCount}`);

	console.log("\n=== VALIDATION CYCLE COMPLETE ===");
	process.exit(0);
}

main().catch(console.error);
