const UserData = require("../models/data");
const SiteDailyPerformance = require("../models/SiteDailyPerformance");
const SiteHealthScore = require("../models/SiteHealthScore");
const FleetPerformanceMetrics = require("../models/FleetPerformanceMetrics");
const calculatePercentiles = require("../utils/calculatePercentiles");
const calculateStdDev = require("../utils/calculateStdDev");

const average = (values = []) => {
	const nums = values.map(Number).filter(Number.isFinite);
	if (!nums.length) return 0;
	return nums.reduce((sum, value) => sum + value, 0) / nums.length;
};

const getCapacityBand = (capacity) => {
	if (capacity < 5) return "under_5kw";
	if (capacity < 10) return "5_to_10kw";
	if (capacity < 20) return "10_to_20kw";
	return "20kw_plus";
};

const getAgeCohort = (createdAt) => {
	if (!createdAt) return "unknown";
	const ageYears = (Date.now() - new Date(createdAt).getTime()) / (365 * 24 * 60 * 60 * 1000);
	if (ageYears < 1) return "0_to_1yr";
	if (ageYears < 3) return "1_to_3yr";
	if (ageYears < 5) return "3_to_5yr";
	return "5yr_plus";
};

const getLatestPerformanceByUser = async (userIds) => {
	const rows = await SiteDailyPerformance.find({ user_id: { $in: userIds } })
		.sort({ user_id: 1, date: -1 })
		.lean();
	const latestByUser = new Map();
	for (const row of rows) {
		const key = String(row.user_id);
		if (!latestByUser.has(key)) {
			latestByUser.set(key, row);
		}
	}
	return Array.from(latestByUser.values());
};

async function calculateFleetMetrics() {
	const users = await UserData.find().lean();
	if (!users.length) return null;

	const userIds = users.map((user) => user._id);
	const performances = await getLatestPerformanceByUser(userIds);
	const performanceRatios = performances.map((item) => item.performance_ratio).filter(Number.isFinite);
	const sorted = [...performanceRatios].sort((a, b) => a - b);
	const percentiles = calculatePercentiles(sorted);
	const healthScores = await SiteHealthScore.find({ user_id: { $in: userIds } }).lean();
	const snapshotDate = performances
		.map((item) => item.date)
		.sort()
		.pop() || new Date().toISOString().split("T")[0];

	const byInverterType = users.reduce((acc, user) => {
		const serial = String(user.inverterSerialNumber || "").toLowerCase();
		const type = serial.startsWith("fox") ? "foxes" : serial ? "solaredge" : "not_configured";
		acc[type] = (acc[type] || 0) + 1;
		return acc;
	}, {});

	const byAgeCohort = users.reduce((acc, user) => {
		const cohort = getAgeCohort(user.createdAt);
		acc[cohort] = (acc[cohort] || 0) + 1;
		return acc;
	}, {});

	const byCapacity = users.reduce((acc, user) => {
		const band = getCapacityBand(Number(user.systemCapacity || 0));
		acc[band] = (acc[band] || 0) + 1;
		return acc;
	}, {});
	const userNamesById = users.reduce((acc, user) => {
		acc[String(user._id)] = user.name;
		return acc;
	}, {});

	const ranked = performances
		.map((item) => ({
			user_id: item.user_id,
			user_name: userNamesById[String(item.user_id)] || "",
			performance_ratio: item.performance_ratio,
			baseline_drift_percent: item.baseline_drift_percent,
			data_source: item.data_source,
			analytics_confidence: item.analytics_confidence
		}))
		.sort((a, b) => b.performance_ratio - a.performance_ratio);
	const fleetAverage = average(performanceRatios);
	const degraded = [...ranked]
		.filter((item) => item.performance_ratio < fleetAverage || Number(item.baseline_drift_percent || 0) < -3)
		.sort((a, b) => a.performance_ratio - b.performance_ratio);

	const payload = {
		snapshot_date: snapshotDate,
		fleet_avg_performance_ratio: Number(fleetAverage.toFixed(4)),
		fleet_median_performance_ratio: Number((percentiles.p50 || 0).toFixed(4)),
		fleet_std_dev: Number(calculateStdDev(performanceRatios).toFixed(4)),
		p10_performance: Number((percentiles.p10 || 0).toFixed(4)),
		p25_performance: Number((percentiles.p25 || 0).toFixed(4)),
		p50_performance: Number((percentiles.p50 || 0).toFixed(4)),
		p75_performance: Number((percentiles.p75 || 0).toFixed(4)),
		p90_performance: Number((percentiles.p90 || 0).toFixed(4)),
		total_sites: users.length,
		healthy_sites: healthScores.filter((item) => ["EXCELLENT", "HEALTHY"].includes(item.health_category)).length,
		warning_sites: healthScores.filter((item) => ["MONITOR", "WARNING", "RISK"].includes(item.health_category)).length,
		critical_sites: healthScores.filter((item) => item.health_category === "CRITICAL").length,
		offline_sites: performances.filter((item) => item.inverter_offline).length,
		by_inverter_type: byInverterType,
		by_age_cohort: byAgeCohort,
		by_capacity: byCapacity,
		top_5_best_performers: ranked.slice(0, 5),
		top_5_worst_performers: degraded.slice(0, 5),
		calculated_at: new Date()
	};

	await FleetPerformanceMetrics.findOneAndUpdate({ snapshot_date: snapshotDate }, payload, {
		upsert: true,
		returnDocument: "after"
	});

	return payload;
}

module.exports = {
	calculateFleetMetrics
};
