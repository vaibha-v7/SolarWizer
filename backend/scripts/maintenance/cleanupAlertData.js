const mongoose = require("mongoose");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env") });

const Alert = require("../models/Alert");
const AlertHistory = require("../models/AlertHistory");
const SiteMonitoringState = require("../models/SiteMonitoringState");

const isDryRun = process.argv.includes("--dry-run");

async function main() {
	if (isDryRun) {
		console.log("=== DRY RUN MODE: No data will be modified ===");
	} else {
		console.log("=== LIVE MODE: Data will be modified ===");
	}

	await mongoose.connect(process.env.MONGO_DB_URI);

	console.log("\n--- 1. SiteMonitoringState Cleanup ---");
	const states = await SiteMonitoringState.find();
	let statesUpdated = 0;

	for (const state of states) {
		let modified = false;
		
		if (state.performance_window && state.performance_window.length > 0) {
			const dateMap = new Map();
			for (const entry of state.performance_window) {
				dateMap.set(entry.date, entry);
			}

			const uniqueEntries = Array.from(dateMap.values());
			uniqueEntries.sort((a, b) => new Date(a.date) - new Date(b.date));

			const targetLength = state.active_alert_id ? 30 : 7;
			const trimmedEntries = uniqueEntries.slice(-targetLength);

			if (state.performance_window.length !== trimmedEntries.length || 
				JSON.stringify(state.performance_window) !== JSON.stringify(trimmedEntries)) {
				
				console.log(`[SiteMonitoringState] User ${state.user_id}: Deduplicating window from ${state.performance_window.length} to ${trimmedEntries.length}`);
				state.performance_window = trimmedEntries;
				modified = true;
			}
		}

		if (modified) {
			statesUpdated++;
			if (!isDryRun) {
				await state.save();
			}
		}
	}
	console.log(`Total SiteMonitoringStates ${isDryRun ? 'to update' : 'updated'}: ${statesUpdated}`);

	console.log("\n--- 2. Alert Cleanup (Duplicates & Days Active) ---");
	const openAlerts = await Alert.find({ status: { $ne: "RESOLVED" } }).sort({ created_at: 1 });
	const alertGroups = new Map();

	for (const alert of openAlerts) {
		const key = `${alert.site_name}_${alert.severity}_${alert.status}`;
		if (!alertGroups.has(key)) alertGroups.set(key, []);
		alertGroups.get(key).push(alert);
	}

	let alertsDeleted = 0;
	let alertsUpdated = 0;

	for (const [key, group] of alertGroups.entries()) {
		if (group.length > 1) {
			console.log(`[Alert] Found ${group.length} duplicates for ${key}. Keeping oldest: ${group[0]._id}`);
			for (let i = 1; i < group.length; i++) {
				console.log(`  -> Deleting duplicate: ${group[i]._id}`);
				alertsDeleted++;
				if (!isDryRun) {
					await Alert.findByIdAndDelete(group[i]._id);
				}
			}
		}

		const primaryAlert = group[0];
		if (primaryAlert.severity === "OFFLINE") {
			const state = await SiteMonitoringState.findOne({ user_id: primaryAlert.user_id });
			if (state) {
				if (!state.offline_since) {
					console.log(`[Alert] Backfilling offline_since for ${primaryAlert.site_name} using alert created_at`);
					state.offline_since = new Date(primaryAlert.created_at);
					if (!isDryRun) await state.save();
				}

				const msPerDay = 1000 * 60 * 60 * 24;
				const todayMs = new Date(new Date().toISOString().split("T")[0]).getTime();
				const offlineSinceMs = new Date(new Date(state.offline_since).toISOString().split("T")[0]).getTime();
				const daysActive = Math.floor((todayMs - offlineSinceMs) / msPerDay) + 1;

				if (primaryAlert.consecutive_days !== daysActive) {
					console.log(`[Alert] Recalculating days_active for ${primaryAlert.site_name}: ${primaryAlert.consecutive_days} -> ${daysActive}`);
					primaryAlert.consecutive_days = daysActive;
					alertsUpdated++;
					if (!isDryRun) await primaryAlert.save();
				}
			}
		}
	}
	console.log(`Total Alerts ${isDryRun ? 'to delete' : 'deleted'}: ${alertsDeleted}`);
	console.log(`Total Alerts ${isDryRun ? 'to update' : 'updated'}: ${alertsUpdated}`);

	console.log("\n--- 3. AlertHistory Read-Only Audit ---");
	const history = await AlertHistory.find().lean();
	let duplicateIds = 0;
	let missingDates = 0;
	let outOfOrderWindows = 0;
	
	const incidentIdSet = new Set();
	for (const record of history) {
		const id = record.incident_id || record._id.toString();
		if (incidentIdSet.has(id)) {
			console.log(`[AlertHistory] Duplicate incident ID found: ${id}`);
			duplicateIds++;
		}
		incidentIdSet.add(id);

		if (!record.incident_start_date || !record.incident_end_date) {
			console.log(`[AlertHistory] Missing start/end date for: ${id}`);
			missingDates++;
		}

		if (record.performance_window && record.performance_window.length > 1) {
			for (let i = 1; i < record.performance_window.length; i++) {
				const prev = new Date(record.performance_window[i-1].date);
				const curr = new Date(record.performance_window[i].date);
				if (curr < prev) {
					console.log(`[AlertHistory] Out of order window for: ${id}`);
					outOfOrderWindows++;
					break;
				}
			}
		}
	}
	console.log(`[Audit] Duplicate IDs: ${duplicateIds}`);
	console.log(`[Audit] Missing Dates: ${missingDates}`);
	console.log(`[Audit] Out of Order Windows: ${outOfOrderWindows}`);

	console.log("\nCleanup complete.");
	process.exit(0);
}

main().catch(console.error);
