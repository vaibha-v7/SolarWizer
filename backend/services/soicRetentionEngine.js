const SiteDailyPerformance = require("../models/SiteDailyPerformance");
const SiteHealthSnapshot = require("../models/SiteHealthSnapshot");
const FleetPerformanceMetrics = require("../models/FleetPerformanceMetrics");
const { RETENTION_DAYS } = require("./performanceRatioEngine");

const getDateDaysAgo = (daysAgo) => {
	const date = new Date();
	date.setUTCDate(date.getUTCDate() - daysAgo);
	return date.toISOString().split("T")[0];
};

async function enforceSoicRetention(days = RETENTION_DAYS) {
	const cutoffDate = getDateDaysAgo(days - 1);
	const [performance, health, fleet] = await Promise.all([
		SiteDailyPerformance.deleteMany({ date: { $lt: cutoffDate } }),
		SiteHealthSnapshot.deleteMany({ snapshot_date: { $lt: cutoffDate } }),
		FleetPerformanceMetrics.deleteMany({ snapshot_date: { $lt: cutoffDate } })
	]);

	return {
		cutoffDate,
		performanceDeleted: performance.deletedCount || 0,
		healthDeleted: health.deletedCount || 0,
		fleetDeleted: fleet.deletedCount || 0
	};
}

module.exports = {
	enforceSoicRetention
};
