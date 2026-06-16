const cron = require("node-cron");
const DailyPrediction = require("../models/DailyPrediction");
const UserData = require("../models/data");
const { getTodayInverterGeneration } = require("./inverterTelemetryService");
const { sendPositiveProductionEmails } = require("./positiveProductionEmailService");

const AIML_BASE_URL = process.env.AIML_BASE_URL || process.env.AIML_API_URL || "http://127.0.0.1:8000";
const DAILY_PREDICTION_TIMEZONE = process.env.DAILY_PREDICTION_TIMEZONE || "Asia/Kolkata";

const isFiniteNumber = (value) => Number.isFinite(Number(value));

const formatKwh = (value) => {
	const numberValue = Number(value);
	return Number.isFinite(numberValue) ? Number(numberValue.toFixed(2)) : null;
};

const getDailyPredictionDate = (date = new Date()) => date.toISOString().split("T")[0];

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

/**
 * Fetch daily prediction from AIML API and store in database
 * Keeps rolling 6-day window (today + previous 5 days)
 */
async function fetchAndStoreDailyPredictions(options = {}) {
	const result = {
		totalUsers: 0,
		stored: 0,
		skipped: 0,
		failed: 0,
		emailNotifications: null,
		errors: []
	};

	try {
		console.log(`[Daily Prediction] Starting fetch at ${new Date().toISOString()}`);

		const query = options.userId ? { _id: options.userId } : {};
		const users = await UserData.find(query);
		result.totalUsers = users.length;

		if (!users.length) {
			console.log("[Daily Prediction] No users found");
			return result;
		}

		const today = getDailyPredictionDate();
		const cutoffDate = new Date();
		cutoffDate.setDate(cutoffDate.getDate() - 5);
		const cutoffDateStr = getDailyPredictionDate(cutoffDate);

		for (const user of users) {
			try {
				const latitude = user.location?.latitude;
				const longitude = user.location?.longitude;
				const { systemCapacity, tiltDeg, azimuthDeg, inverterSerialNumber, siteId } = user;

				if (
					!isFiniteNumber(latitude) ||
					!isFiniteNumber(longitude) ||
					!isFiniteNumber(systemCapacity) ||
					!isFiniteNumber(tiltDeg) ||
					!isFiniteNumber(azimuthDeg)
				) {
					console.log(`[Daily Prediction] Skipping user ${user._id} - missing location/system data`);
					result.skipped += 1;
					result.errors.push({
						userId: String(user._id),
						message: "Missing location or system data"
					});
					continue;
				}

				const aimlUrl = new URL("/predict-today", AIML_BASE_URL);
				aimlUrl.searchParams.append("lat", latitude);
				aimlUrl.searchParams.append("lon", longitude);
				aimlUrl.searchParams.append("capacity_kw", systemCapacity);
				aimlUrl.searchParams.append("tilt", tiltDeg);
				aimlUrl.searchParams.append("azimuth", azimuthDeg);

				const prediction = await fetchJsonWithTimeout(aimlUrl.toString());
				let inverterGenerationToday = "N/A";
				let differenceKwh = null;
				let comparison = "N/A";

				try {
					inverterGenerationToday = await getTodayInverterGeneration({
						inverterSerialNumber,
						siteId,
						fetchJsonWithTimeout,
						baseUrl: AIML_BASE_URL
					});
				} catch (inverterError) {
					console.error(
						`[Daily Prediction] Inverter generation fetch failed for user ${user._id}:`,
						inverterError.message
					);
				}

				const predictedKwh = formatKwh(prediction.daily_energy_kwh);
				const inverterKwh = formatKwh(inverterGenerationToday);

				if (predictedKwh !== null && inverterKwh !== null) {
					differenceKwh = Number((inverterKwh - predictedKwh).toFixed(2));
					if (differenceKwh > 0) comparison = "greater";
					else if (differenceKwh < 0) comparison = "lesser";
					else comparison = "equal";
				}

				await DailyPrediction.findOneAndUpdate(
					{ userId: user._id, date: today },
					{
						userId: user._id,
						date: today,
						predicted_kwh: prediction.daily_energy_kwh || 0,
						peak_power_kw: prediction.peak_power_kw || 0,
						avg_temperature: prediction.avg_temperature || 0,
						avg_cloud_cover: prediction.avg_cloud_cover || 0,
						inverter_real_time_kwh: inverterGenerationToday,
						difference_kwh: differenceKwh,
						comparison
					},
					{ upsert: true, returnDocument: "after" }
				);

				console.log(`[Daily Prediction] Stored prediction for user ${user._id} on ${today}`);
				result.stored += 1;

				await DailyPrediction.deleteMany({
					userId: user._id,
					date: { $lt: cutoffDateStr }
				});

				console.log(`[Daily Prediction] Cleaned old predictions for user ${user._id} before ${cutoffDateStr}`);
			} catch (err) {
				console.error(`[Daily Prediction] Error processing user ${user._id}:`, err.message);
				result.failed += 1;
				result.errors.push({
					userId: String(user._id),
					message: err.message
				});
			}
		}

		if (process.env.POSITIVE_PRODUCTION_EMAILS_DISABLED !== "true") {
			try {
				result.emailNotifications = await sendPositiveProductionEmails({
					date: today,
					userId: options.userId
				});
			} catch (emailError) {
				console.error("[Daily Prediction] Positive production email notification failed:", emailError.message);
				result.errors.push({
					message: `Positive production email notification failed: ${emailError.message}`
				});
			}
		}

		console.log("[Daily Prediction] Batch fetch completed successfully");
	} catch (err) {
		console.error("[Daily Prediction] Scheduler error:", err.message);
		result.failed += 1;
		result.errors.push({ message: err.message });
	}

	return result;
}

/**
 * Initialize the daily prediction scheduler
 * Runs every day at 7 PM (19:00) in the configured timezone
 */
function initializeDailyPredictionScheduler() {
	const job = cron.schedule("0 19 * * *", fetchAndStoreDailyPredictions, {
		scheduled: true,
		timezone: DAILY_PREDICTION_TIMEZONE
	});

	console.log(`[Daily Prediction] Scheduler initialized - runs daily at 7 PM ${DAILY_PREDICTION_TIMEZONE}`);

	return job;
}

/**
 * Manual trigger for testing (can be called from route)
 */
async function triggerDailyPredictionFetch(options = {}) {
	console.log("[Daily Prediction] Manual trigger initiated");
	return fetchAndStoreDailyPredictions(options);
}

module.exports = {
	initializeDailyPredictionScheduler,
	triggerDailyPredictionFetch,
	fetchAndStoreDailyPredictions
};
