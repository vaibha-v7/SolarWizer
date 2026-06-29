const UserData = require("../models/data");
const MonthlyData = require("../models/monthlydata");
const DailyPrediction = require("../models/DailyPrediction");
const SiteDailyPerformance = require("../models/SiteDailyPerformance");
const UserMonthlyProduction = require("../models/UserMonthlyProduction");
const SiteMonitoringState = require("../models/SiteMonitoringState");
const Alert = require("../models/Alert");
const AlertHistory = require("../models/AlertHistory");

const AIML_API_URL = process.env.AIML_API_URL || "http://127.0.0.1:8000";



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

const { refreshSolarReportForUser: executeAnalyticsRefresh } = require("../services/analyticsRefreshService");

const getSolarReportForUser = async (req, res) => {
	try {
		const { userId } = req.params;
		const report = await MonthlyData.findOne({ userDataId: userId }).lean();
		
		if (!report) {
			return res.status(404).json({
				message: "Solar report not found. Please click Refresh Report to generate one."
			});
		}

		return res.status(200).json({
			message: "Solar report fetched successfully",
			data: report
		});
	} catch (error) {
		return res.status(500).json({
			message: "Failed to fetch solar report",
			error: error.message
		});
	}
};

const refreshSolarReportForUser = async (req, res) => {
	try {
		const { userId } = req.params;
		
		const { report, metadata } = await executeAnalyticsRefresh(userId);

		return res.status(200).json({
			message: "Solar report regenerated successfully",
			data: { report, metadata }
		});
	} catch (error) {
		return res.status(500).json({
			message: "Failed to regenerate solar report",
			error: error.message
		});
	}
};

const deleteUserData = async (req, res) => {
	try {
		const { userId } = req.params;

		const user = await UserData.findByIdAndDelete(userId);

		if (!user) {
			return res.status(404).json({
				message: "User data not found"
			});
		}

		// Cascade delete all associated operational and analytics data
		await Promise.all([
			MonthlyData.deleteOne({ userDataId: userId }),
			DailyPrediction.deleteMany({ userId: userId }),
			SiteDailyPerformance.deleteMany({ user_id: userId }),
			UserMonthlyProduction.deleteMany({ userId: userId }),
			SiteMonitoringState.deleteOne({ user_id: userId }),
			Alert.deleteMany({ user_id: userId }),
			AlertHistory.deleteMany({ user_id: userId })
		]);

		return res.status(200).json({
			message: "User data deleted successfully",
			data: user
		});
	} catch (error) {
		return res.status(500).json({
			message: "Failed to delete user data",
			error: error.message
		});
	}
};

const updateUserData = async (req, res) => {
	try {
		const { userId } = req.params;
		const updatedData = req.body;

		const user = await UserData.findByIdAndUpdate(userId, updatedData, {
			returnDocument: "after",
			runValidators: true
		});

		if (!user) {
			return res.status(404).json({
				message: "User data not found"
			});
		}

		return res.status(200).json({
			message: "User data updated successfully",
			data: user
		});
	} catch (error) {
		return res.status(400).json({
			message: "Failed to update user data",
			error: error.message
		});
	}
};

const getMonthlyProductionForUser = async (req, res) => {
	try {
		const { userId } = req.params;
		const user = await UserData.findById(userId);
		if (!user) {
			return res.status(404).json({
				message: "User data not found"
			});
		}

		// 1. Fetch static monthly predictions
		const monthlyReport = await MonthlyData.findOne({ userDataId: userId }).lean();
		const staticPredictions = monthlyReport?.monthly_energy_kwh || {};

		// 2. Fetch all recorded monthly actual production records
		const records = await UserMonthlyProduction.find({ userId }).lean();

		// Construct the response data
		const currentYear = new Date().getFullYear();
		const yearsSet = new Set(records.map((r) => r.year));
		yearsSet.add(currentYear);
		const years = Array.from(yearsSet).sort((a, b) => a - b);

		const result = [];
		const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

		for (const year of years) {
			for (const month of MONTHS) {
				const record = records.find(
					(r) => r.userId.toString() === userId.toString() && r.year === year && r.month === month
				);

				const predicted = record ? record.predicted_kwh : (staticPredictions[month] || 0);
				const actual = record ? record.actual_kwh : 0;
				const comparison = record ? record.comparison : "N/A";
				const hasData = record ? (record.daily_values && Object.keys(record.daily_values).length > 0) || record.actual_kwh > 0 : false;

				result.push({
					year,
					month,
					predicted_kwh: Number(predicted.toFixed(2)),
					actual_kwh: Number(actual.toFixed(2)),
					comparison,
					hasData
				});
			}
		}

		return res.status(200).json({
			message: "Monthly production retrieved successfully",
			data: result
		});
	} catch (error) {
		return res.status(500).json({
			message: "Failed to fetch monthly production",
			error: error.message
		});
	}
};

module.exports = {
	createUserData,
	listUserData,
	getUserDataById,
	getSolarReportForUser,
	refreshSolarReportForUser,
	deleteUserData,
	updateUserData,
	getMonthlyProductionForUser
};
