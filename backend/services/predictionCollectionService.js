const DailyPrediction = require("../models/DailyPrediction");
const UserData = require("../models/data");
const { getTodayInverterGeneration } = require("./inverterTelemetryService");
const { getDateDaysAgo, getTodayDateString, normalizeDateString } = require("../utils/dateUtils");

const AIML_BASE_URL = process.env.AIML_BASE_URL || process.env.AIML_API_URL || "http://127.0.0.1:8000";

const isFiniteNumber = (value) => Number.isFinite(Number(value));

const formatKwh = (value) => {
	const numberValue = Number(value);
	return Number.isFinite(numberValue) ? Number(numberValue.toFixed(2)) : null;
};

async function fetchJsonWithTimeout(url, timeoutMs = 30000) {
	const controller = new AbortController();
	const timeout = setTimeout(() => controller.abort(), timeoutMs);

	try {
		const response = await fetch(url, { signal: controller.signal });

		if (!response.ok) {
			throw new Error(`AIML API returned ${response.status}`);
		}

		return response.json();
	} finally {
		clearTimeout(timeout);
	}
}

const getUserQuery = ({ userId, activeOnly = false } = {}) => {
	const query = {};
	if (userId) query._id = userId;
	if (activeOnly) {
		query.isDeleted = { $ne: true };
		query.status = { $ne: "deleted" };
	}
	return query;
};

const buildAimlUrl = (user) => {
	const aimlUrl = new URL("/predict-today", AIML_BASE_URL);
	aimlUrl.searchParams.append("lat", user.location.latitude);
	aimlUrl.searchParams.append("lon", user.location.longitude);
	aimlUrl.searchParams.append("capacity_kw", user.systemCapacity);
	aimlUrl.searchParams.append("tilt", user.tiltDeg);
	aimlUrl.searchParams.append("azimuth", user.azimuthDeg);
	return aimlUrl;
};

const hasRequiredSolarInputs = (user) => {
	const latitude = user.location?.latitude;
	const longitude = user.location?.longitude;
	return (
		isFiniteNumber(latitude) &&
		isFiniteNumber(longitude) &&
		isFiniteNumber(user.systemCapacity) &&
		isFiniteNumber(user.tiltDeg) &&
		isFiniteNumber(user.azimuthDeg)
	);
};

const createResult = ({ date, source, sampleType, pipelineId }) => ({
	pipelineId,
	date,
	source,
	sampleType,
	totalUsers: 0,
	expectedSites: 0,
	stored: 0,
	updated: 0,
	skipped: 0,
	skippedFinalized: 0,
	failed: 0,
	finalTelemetryAvailable: 0,
	errors: [],
	warnings: []
});

async function collectAndStoreDailyPredictions(options = {}) {
	const date = normalizeDateString(options.date || getTodayDateString());
	const source = options.source || "unknown";
	const sampleType = options.sampleType || "INTRADAY";
	const pipelineId = options.pipelineId || "";
	const result = createResult({ date, source, sampleType, pipelineId });
	const activeOnly = options.activeOnly !== false;

	console.log(`[Daily Prediction:${source}] Starting collection for ${date}`);

	try {
		const users = await UserData.find(getUserQuery({ userId: options.userId, activeOnly }));
		result.totalUsers = users.length;
		result.expectedSites = users.length;

		if (!users.length) {
			result.warnings.push({ message: "No users found" });
			console.log(`[Daily Prediction:${source}] No users found`);
			return result;
		}

		for (const user of users) {
			try {
				if (!hasRequiredSolarInputs(user)) {
					const message = "Missing location or system data";
					console.log(`[Daily Prediction:${source}] Skipping user ${user._id} - ${message}`);
					result.skipped += 1;
					result.errors.push({ userId: String(user._id), message });
					continue;
				}

				const existing = await DailyPrediction.findOne({ userId: user._id, date });
				if (existing?.finalized_at && !options.allowOverwriteFinalized) {
					result.skipped += 1;
					result.skippedFinalized += 1;
					result.warnings.push({
						userId: String(user._id),
						message: `DailyPrediction for ${date} is finalized and was not overwritten`
					});
					continue;
				}

				const prediction = await fetchJsonWithTimeout(buildAimlUrl(user).toString());
				let inverterGenerationToday = "N/A";
				let differenceKwh = null;
				let comparison = "N/A";

				try {
					inverterGenerationToday = await getTodayInverterGeneration({
						inverterSerialNumber: user.inverterSerialNumber,
						siteId: user.siteId,
						fetchJsonWithTimeout,
						baseUrl: AIML_BASE_URL
					});
				} catch (inverterError) {
					const message = `Inverter generation fetch failed: ${inverterError.message}`;
					console.error(`[Daily Prediction:${source}] ${message} for user ${user._id}`);
					result.warnings.push({ userId: String(user._id), message });
				}

				const predictedKwh = formatKwh(prediction.daily_energy_kwh);
				const inverterKwh = formatKwh(inverterGenerationToday);

				if (predictedKwh !== null && inverterKwh !== null) {
					differenceKwh = Number((inverterKwh - predictedKwh).toFixed(2));
					if (differenceKwh > 0) comparison = "greater";
					else if (differenceKwh < 0) comparison = "lesser";
					else comparison = "equal";
					result.finalTelemetryAvailable += 1;
				}

				const now = new Date();
				const update = {
					userId: user._id,
					date,
					predicted_kwh: prediction.daily_energy_kwh || 0,
					peak_power_kw: prediction.peak_power_kw || 0,
					avg_temperature: prediction.avg_temperature || 0,
					avg_cloud_cover: prediction.avg_cloud_cover || 0,
					inverter_real_time_kwh: inverterGenerationToday,
					difference_kwh: differenceKwh,
					comparison,
					sample_type: sampleType,
					source
				};

				if (source === "manual_fetch") {
					update.last_manual_fetch_at = now;
				} else if (source === "daily_scheduler") {
					update.last_scheduled_fetch_at = now;
				}

				await DailyPrediction.findOneAndUpdate(
					{ userId: user._id, date },
					update,
					{ upsert: true, returnDocument: "after", runValidators: true, setDefaultsOnInsert: true }
				);

				if (existing) result.updated += 1;
				else result.stored += 1;

				console.log(`[Daily Prediction:${source}] Stored prediction for user ${user._id} on ${date}`);
			} catch (err) {
				console.error(`[Daily Prediction:${source}] Error processing user ${user._id}:`, err.message);
				result.failed += 1;
				result.errors.push({ userId: String(user._id), message: err.message });
			}
		}

		if (options.pruneUnfinalizedOlderThanDays) {
			const cutoffDateStr = getDateDaysAgo(Number(options.pruneUnfinalizedOlderThanDays));
			await DailyPrediction.deleteMany({
				finalized_at: null,
				date: { $lt: cutoffDateStr }
			});
		}

		console.log(`[Daily Prediction:${source}] Collection completed for ${date}`);
	} catch (err) {
		console.error(`[Daily Prediction:${source}] Collection error:`, err.message);
		result.failed += 1;
		result.errors.push({ message: err.message });
	}

	return result;
}

module.exports = {
	collectAndStoreDailyPredictions,
	fetchJsonWithTimeout,
	formatKwh
};
