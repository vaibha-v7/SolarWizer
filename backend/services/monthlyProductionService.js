const UserMonthlyProduction = require("../models/UserMonthlyProduction");
const SiteDailyPerformance = require("../models/SiteDailyPerformance");
const MonthlyData = require("../models/monthlydata");

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/**
 * Idempotently update UserMonthlyProduction for a user on a given date.
 * Updates the daily_values map and recalculates month total and comparison.
 */
async function updateMonthlyProductionForUserDate(userId, dateStr) {
	try {
		if (!userId || !dateStr) return;

		// Parse the date YYYY-MM-DD
		const parts = dateStr.split("-");
		if (parts.length !== 3) return;

		const year = parseInt(parts[0], 10);
		const monthIndex = parseInt(parts[1], 10) - 1;
		if (Number.isNaN(year) || Number.isNaN(monthIndex) || monthIndex < 0 || monthIndex > 11) {
			return;
		}

		const monthName = MONTHS[monthIndex];

		// 1. Get static prediction for this month from MonthlyData
		const monthlyReport = await MonthlyData.findOne({ userDataId: userId }).lean();
		const predictedMonthlyKwh = monthlyReport?.monthly_energy_kwh?.[monthName] || 0;

		// 2. Find or create the monthly record
		let monthlyRecord = await UserMonthlyProduction.findOne({ userId, year, month: monthName });
		if (!monthlyRecord) {
			monthlyRecord = new UserMonthlyProduction({
				userId,
				year,
				month: monthName,
				predicted_kwh: Number(predictedMonthlyKwh.toFixed(2)),
				actual_kwh: 0,
				comparison: "N/A",
				daily_values: {}
			});
		}

		// 3. Find the daily performance record
		const dailyPerformance = await SiteDailyPerformance.findOne({ user_id: userId, date: dateStr }).lean();
		
		if (dailyPerformance) {
			// Update the map entry for this date
			monthlyRecord.daily_values.set(dateStr, {
				actual_generation_kwh: dailyPerformance.actual_generation_kwh || 0,
				predicted_generation_kwh: dailyPerformance.predicted_generation_kwh || 0
			});
		}

		// 4. Recalculate sums
		let totalActual = 0;
		let totalDailyPredicted = 0;
		let hasAnyData = false;

		for (const [_, val] of monthlyRecord.daily_values.entries()) {
			totalActual += val.actual_generation_kwh || 0;
			totalDailyPredicted += val.predicted_generation_kwh || 0;
			hasAnyData = true;
		}

		monthlyRecord.actual_kwh = Number(totalActual.toFixed(2));
		
		// Always update the static prediction baseline in case the solar report was updated
		monthlyRecord.predicted_kwh = Number(predictedMonthlyKwh.toFixed(2));

		// 5. Determine comparison
		// If we have no data tracked at all, comparison is N/A
		if (!hasAnyData) {
			monthlyRecord.comparison = "N/A";
		} else {
			// Compare actual against predicted
			// We can round both values to 2 decimal places to avoid floating point comparison issues
			const diff = Number((monthlyRecord.actual_kwh - monthlyRecord.predicted_kwh).toFixed(2));
			if (diff > 0) {
				monthlyRecord.comparison = "greater";
			} else if (diff < 0) {
				monthlyRecord.comparison = "lesser";
			} else {
				monthlyRecord.comparison = "equal";
			}
		}

		await monthlyRecord.save();
		console.log(`[Monthly Production] Updated ${monthName} ${year} for user ${userId}. Actual: ${monthlyRecord.actual_kwh} kWh, Pred: ${monthlyRecord.predicted_kwh} kWh, Status: ${monthlyRecord.comparison}`);
	} catch (error) {
		console.error(`[Monthly Production] Error updating monthly record for user ${userId} on date ${dateStr}:`, error.message);
	}
}

/**
 * One-time historical sync. Queries all existing SiteDailyPerformance records
 * and aggregates them into monthly production documents.
 */
async function syncAllHistoricalMonthlyProduction() {
	try {
		console.log("[Monthly Production] Starting historical data sync...");
		
		// Query all daily performances sorted by date ascending
		const performances = await SiteDailyPerformance.find().sort({ date: 1 }).lean();
		console.log(`[Monthly Production] Found ${performances.length} daily performance records to sync.`);

		for (const perf of performances) {
			await updateMonthlyProductionForUserDate(perf.user_id, perf.date);
		}

		console.log("[Monthly Production] Historical data sync completed successfully.");
	} catch (error) {
		console.error("[Monthly Production] Historical data sync failed:", error.message);
	}
}

module.exports = {
	updateMonthlyProductionForUserDate,
	syncAllHistoricalMonthlyProduction
};
