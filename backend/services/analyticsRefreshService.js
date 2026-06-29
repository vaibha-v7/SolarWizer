const UserData = require("../models/data");
const MonthlyData = require("../models/monthlydata");
const UserMonthlyProduction = require("../models/UserMonthlyProduction");

const AIML_API_URL = process.env.AIML_API_URL || "http://127.0.0.1:8000";
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const normalizeMonthlyEnergy = (monthlyEnergy = {}) => {
	const normalized = {};
	MONTHS.forEach((month) => {
		normalized[month] = Number(monthlyEnergy[month] ?? 0);
	});
	return normalized;
};

const mapUserToAimlPayload = (user) => ({
	lat: user.location.latitude,
	lon: user.location.longitude,
	system_size_kw: user.systemCapacity,
	tilt: user.tiltDeg,
	azimuth: user.azimuthDeg,
	shading_factor: user.shadingFactor,
	dc_ac_ratio: user.dc_ac_ratio ?? 1.2,
	inv_efficiency: user.inv_efficiency ?? 98,
	bifaciality: user.bifaciality ?? 0,
	losses: [
		user.soilingLossPercent,
		user.inverterLossPercent,
		user.wiringLossPercent,
		user.miscLossPercent
	]
});

/**
 * Regenerates the analytical predictions for a user and updates
 * historical analytical views without modifying operational data.
 */
const refreshSolarReportForUser = async (userId) => {
	const user = await UserData.findById(userId);
	if (!user) {
		throw new Error("User data not found");
	}

	const aimlPayload = mapUserToAimlPayload(user);
	let pvgisPrediction = null;
	let pvwattsPrediction = null;

	try {
		const resp1 = await fetch(`${AIML_API_URL}/predict1`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(aimlPayload)
		});
		if (resp1.ok) pvgisPrediction = await resp1.json();
	} catch (e) {
		// continue
	}

	try {
		const resp2 = await fetch(`${AIML_API_URL}/predict2`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(aimlPayload)
		});
		if (resp2.ok) pvwattsPrediction = await resp2.json();
	} catch (e) {
		// continue
	}

	if (!pvgisPrediction && !pvwattsPrediction) {
		throw new Error("Failed to reach AIML Prediction Service. Check AI connectivity.");
	}

	const primary = pvgisPrediction || pvwattsPrediction || {};

	const reportPayload = {
		userDataId: user._id,
		annual_energy_kwh: Number(primary.annual_energy_kwh ?? 0),
		monthly_energy_kwh: normalizeMonthlyEnergy(primary.monthly_energy_kwh),
		performance_ratio: Number(primary.performance_ratio ?? 0),
		forecast_7_days: Array.isArray(primary.forecast_7_days) ? primary.forecast_7_days : [],
		pvgis: pvgisPrediction ?? {},
		pvwatts: pvwattsPrediction ?? {}
	};

	const monthlyReport = await MonthlyData.findOneAndUpdate(
		{ userDataId: user._id },
		{ $set: reportPayload },
		{
			returnDocument: "after",
			upsert: true,
			runValidators: true,
			setDefaultsOnInsert: true
		}
	);

	// Fetch all existing historical records to update their prediction baseline
	const existingRecords = await UserMonthlyProduction.find({ userId: user._id }).lean();
	
	const bulkOps = [];
	let monthsUpdated = 0;
	let monthsUnchanged = 0;

	for (const record of existingRecords) {
		const newPredicted = reportPayload.monthly_energy_kwh[record.month] || 0;
		const currentPredicted = record.predicted_kwh || 0;
		
		// Skip write if the prediction didn't change (rounded to 2 decimals)
		if (Number(newPredicted.toFixed(2)) === Number(currentPredicted.toFixed(2))) {
			monthsUnchanged++;
			continue;
		}

		monthsUpdated++;

		const predicted_kwh = Number(newPredicted.toFixed(2));
		const actual_kwh = record.actual_kwh || 0;
		
		let comparison = "N/A";
		// Only recalculate comparison if we have actual tracked data
		if (record.comparison !== "N/A") {
			const diff = Number((actual_kwh - predicted_kwh).toFixed(2));
			if (diff > 0) comparison = "greater";
			else if (diff < 0) comparison = "lesser";
			else comparison = "equal";
		}

		bulkOps.push({
			updateOne: {
				filter: { _id: record._id },
				update: {
					$set: {
						predicted_kwh,
						comparison
					}
				}
			}
		});
	}

	if (bulkOps.length > 0) {
		await UserMonthlyProduction.bulkWrite(bulkOps);
	}

	const metadata = {
		refreshed_at: new Date().toISOString(),
		prediction_model: "v3",
		months_updated: monthsUpdated,
		months_unchanged: monthsUnchanged
	};

	return {
		report: monthlyReport,
		metadata
	};
};

module.exports = {
	refreshSolarReportForUser
};
