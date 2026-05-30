const express = require("express");
const mongoose = require("mongoose");
const DailyPrediction = require("../models/DailyPrediction");

const router = express.Router();

const formatNumber = (value) => {
	const numberValue = Number(value ?? 0);
	return Number.isFinite(numberValue) ? Number(numberValue.toFixed(2)) : 0;
};

/**
 * GET /users/:userId/daily-predictions
 * Fetch 6-day prediction history (today + previous 5 days)
 * Returns predictions with predicted column and inverter real-time column (N/A for now)
 */
router.get("/:userId/daily-predictions", async (req, res) => {
	try {
		const { userId } = req.params;

		if (!mongoose.Types.ObjectId.isValid(userId)) {
			return res.status(400).json({
				success: false,
				message: "Invalid user ID format"
			});
		}

		const today = new Date();
		const sixDaysAgo = new Date();
		sixDaysAgo.setDate(today.getDate() - 5);

		const todayStr = today.toISOString().split("T")[0];
		const sixDaysAgoStr = sixDaysAgo.toISOString().split("T")[0];

		const predictions = await DailyPrediction.find({
			userId,
			date: {
				$gte: sixDaysAgoStr,
				$lte: todayStr
			}
		})
			.sort({ date: -1 })
			.lean();

		const formattedData = predictions.map((pred) => ({
			date: pred.date,
			predicted_kwh: formatNumber(pred.predicted_kwh),
			inverter_real_time_kwh: pred.inverter_real_time_kwh ?? "N/A",
			peak_power_kw: formatNumber(pred.peak_power_kw),
			avg_temperature: formatNumber(pred.avg_temperature),
			avg_cloud_cover: formatNumber(pred.avg_cloud_cover),
			difference_kwh: Number.isFinite(Number(pred.difference_kwh)) ? Number(Number(pred.difference_kwh).toFixed(2)) : null,
			comparison: pred.comparison ?? "N/A"
		}));

		res.status(200).json({
			success: true,
			data: formattedData,
			count: formattedData.length,
			message: "Daily predictions retrieved successfully"
		});
	} catch (err) {
		console.error("[Daily Predictions Route] Error:", err.message);
		res.status(500).json({
			success: false,
			message: "Failed to fetch daily predictions",
			error: err.message
		});
	}
});

/**
 * POST /users/:userId/daily-predictions/trigger
 * Manual trigger for testing the daily prediction fetch
 * (Optional - for debugging/testing purposes)
 */
router.post("/:userId/daily-predictions/trigger", async (req, res) => {
	try {
		const { userId } = req.params;

		if (!mongoose.Types.ObjectId.isValid(userId)) {
			return res.status(400).json({
				success: false,
				message: "Invalid user ID format"
			});
		}

		const { triggerDailyPredictionFetch } = require("../services/dailyPredictionScheduler");

		const result = await triggerDailyPredictionFetch({ userId });

		if (result.totalUsers === 0) {
			return res.status(404).json({
				success: false,
				message: "User data not found"
			});
		}

		if (result.stored === 0) {
			return res.status(502).json({
				success: false,
				message: result.errors[0]?.message || "Daily prediction could not be stored",
				data: result
			});
		}

		res.status(200).json({
			success: true,
			data: result,
			message: "Daily prediction fetch triggered successfully"
		});
	} catch (err) {
		console.error("[Daily Predictions Trigger] Error:", err.message);
		res.status(500).json({
			success: false,
			message: "Failed to trigger daily prediction fetch",
			error: err.message
		});
	}
});

module.exports = router;
