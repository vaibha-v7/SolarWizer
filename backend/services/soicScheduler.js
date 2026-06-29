const UserData = require("../models/data");
const { createOrUpdateSiteDailyPerformance } = require("./performanceRatioEngine");
const { recordHealthMetric } = require("./pipelineTelemetryService");

const runSoicPipeline = async (options = {}) => {
	const query = options.userId ? { _id: options.userId } : {};
	const users = await UserData.find(query).select("_id").lean();
	if (!users.length) return { usersProcessed: 0 };

	const result = await createOrUpdateSiteDailyPerformance(options);
	return {
		usersProcessed: users.length,
		...result
	};
};

module.exports = {
	runSoicPipeline
};
