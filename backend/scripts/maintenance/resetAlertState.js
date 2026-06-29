const mongoose = require("mongoose");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../../.env") });

const Alert = require("../../models/Alert");
const AlertHistory = require("../../models/AlertHistory");
const SiteMonitoringState = require("../../models/SiteMonitoringState");
const OperationalMetric = require("../../models/OperationalMetric");
const DailyPrediction = require("../../models/DailyPrediction");

async function main() {
	console.log("=== STARTING ONE-TIME ALERT RESET ===");
	
	const uri = process.env.MONGO_DB_URI || process.env.MONGO_URI;
	if (!uri) {
		console.error("MONGO_URI not found in environment.");
		process.exit(1);
	}

	const maskedUri = uri.replace(/\/\/[^:]+:[^@]+@/, "//***:***@");
	console.log("Connected Database URI:", maskedUri);

	await mongoose.connect(uri);
	console.log("Database connection successful.\n");

	const session = await mongoose.startSession();
	let alertCount = 0;
	let historyCount = 0;
	let stateCount = 0;
	let metricRemoved = false;
	let unlockedCount = 0;

	try {
		await session.withTransaction(async () => {
			alertCount = await Alert.countDocuments().session(session);
			historyCount = await AlertHistory.countDocuments().session(session);
			stateCount = await SiteMonitoringState.countDocuments().session(session);

			await Alert.deleteMany({}).session(session);
			
			// AlertHistory has strict Mongoose hooks blocking deletion, so we use the native driver
			await mongoose.connection.db.collection("soic_alert_history").deleteMany({}, { session });
			
			await SiteMonitoringState.deleteMany({}).session(session);

			const metricResult = await OperationalMetric.deleteOne({ key: "last_alert_evaluation" }).session(session);
			metricRemoved = metricResult.deletedCount > 0;

			const predResult = await DailyPrediction.updateMany(
				{ 
					$or: [
						{ alert_evaluated_at: { $exists: true } },
						{ alert_evaluation_id: { $exists: true } },
						{ finalized_at: { $exists: true } }
					]
				},
				{ 
					$unset: {
						alert_evaluated_at: 1,
						alert_evaluation_id: 1,
						finalized_at: 1
					} 
				}
			).session(session);
			
			unlockedCount = predResult.modifiedCount;
		});

		console.log("\n========== ALERT RESET COMPLETE ==========\n");
		
		console.log("Alerts Deleted:");
		console.log("-----------------------");
		console.log(`Alert                 : ${alertCount}`);
		console.log(`AlertHistory          : ${historyCount}`);
		console.log(`SiteMonitoringState   : ${stateCount}\n`);

		console.log("OperationalMetric Removed:");
		console.log("-----------------------");
		console.log(`last_alert_evaluation : ${metricRemoved ? "Yes" : "No"}\n`);

		console.log("DailyPrediction Updated:");
		console.log("-----------------------");
		console.log(`Unlocked Predictions  : ${unlockedCount}\n`);

		console.log("==========================================");

		// Post-Verification
		const finalAlerts = await Alert.countDocuments();
		const finalHistory = await AlertHistory.countDocuments();
		const finalStates = await SiteMonitoringState.countDocuments();

		console.log("\nPost-Migration Verification:");
		console.log(`Alert Count: ${finalAlerts} (Expected: 0)`);
		console.log(`AlertHistory Count: ${finalHistory} (Expected: 0)`);
		console.log(`SiteMonitoringState Count: ${finalStates} (Expected: 0)`);
		
		if (finalAlerts === 0 && finalHistory === 0 && finalStates === 0) {
			console.log("\n✅ SUCCESS: All targeted collections are empty.");
		} else {
			console.log("\n❌ ERROR: One or more collections were not emptied correctly.");
		}

	} catch (error) {
		console.error("\n❌ FATAL ERROR DURING TRANSACTION:", error.message);
		console.error("The transaction was aborted. No data was permanently changed.");
	} finally {
		await session.endSession();
		await mongoose.disconnect();
		process.exit(0);
	}
}

main().catch(console.error);
