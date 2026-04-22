const UserData = require("../models/data");
const MonthlyData = require("../models/monthlydata");

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
	losses: [
		user.soilingLossPercent,
		user.inverterLossPercent,
		user.wiringLossPercent,
		user.miscLossPercent
	]
});

const createUserData = async (req, res) => {
	try {
		const createdRecord = await UserData.create(req.body);
		return res.status(201).json({
			message: "User data created successfully",
			data: createdRecord
		});
	} catch (error) {
		return res.status(400).json({
			message: "Failed to create user data",
			error: error.message
		});
	}
};

const listUserData = async (req, res) => {
	try {
		const users = await UserData.find().sort({ createdAt: -1, _id: -1 });
		return res.status(200).json({
			message: "Users fetched successfully",
			data: users
		});
	} catch (error) {
		return res.status(500).json({
			message: "Failed to fetch users",
			error: error.message
		});
	}
};

const getUserDataById = async (req, res) => {
	try {
		const { userId } = req.params;
		const user = await UserData.findById(userId);

		if (!user) {
			return res.status(404).json({
				message: "User data not found"
			});
		}

		return res.status(200).json({
			message: "User fetched successfully",
			data: user
		});
	} catch (error) {
		return res.status(500).json({
			message: "Failed to fetch user",
			error: error.message
		});
	}
};

const generateSolarReportForUser = async (req, res) => {
	try {
		const { userId } = req.params;

		const user = await UserData.findById(userId);
		if (!user) {
			return res.status(404).json({
				message: "User data not found"
			});
		}

		const aimlPayload = mapUserToAimlPayload(user);
		const aimlResponse = await fetch(`${AIML_API_URL}/predict`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json"
			},
			body: JSON.stringify(aimlPayload)
		});

		if (!aimlResponse.ok) {
			const errorText = await aimlResponse.text();
			return res.status(502).json({
				message: "AIML service request failed",
				error: errorText
			});
		}

		const prediction = await aimlResponse.json();

		const reportPayload = {
			userDataId: user._id,
			annual_energy_kwh: Number(prediction.annual_energy_kwh ?? 0),
			monthly_energy_kwh: normalizeMonthlyEnergy(prediction.monthly_energy_kwh),
			performance_ratio: Number(prediction.performance_ratio ?? 0),
			forecast_7_days: Array.isArray(prediction.forecast_7_days)
				? prediction.forecast_7_days
				: []
		};

		const monthlyReport = await MonthlyData.findOneAndUpdate(
			{ userDataId: user._id },
			reportPayload,
			{
				new: true,
				upsert: true,
				runValidators: true,
				setDefaultsOnInsert: true
			}
		);

		return res.status(200).json({
			message: "Solar report generated successfully",
			data: monthlyReport
		});
	} catch (error) {
		return res.status(500).json({
			message: "Failed to generate solar report",
			error: error.message
		});
	}
};

module.exports = {
	createUserData,
	listUserData,
	getUserDataById,
	generateSolarReportForUser
};
