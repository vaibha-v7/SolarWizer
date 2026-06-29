const {
	sendPositiveProductionEmails,
	getPositiveProductionEmailLogs,
	verifyGoogleMailConfiguration
} = require("../services/positiveProductionEmailService");

const triggerPositiveProductionEmails = async (req, res) => {
	try {
		const result = await sendPositiveProductionEmails({
			date: req.body.date || req.query.date,
			userId: req.params.userId || req.body.userId || req.query.userId,
			force: req.body.force === true || req.query.force === "true",
			dryRun: req.body.dryRun === true || req.query.dryRun === "true"
		});

		return res.status(200).json({
			success: true,
			message: "Positive production email evaluation completed",
			data: result
		});
	} catch (error) {
		return res.status(400).json({
			success: false,
			message: "Failed to evaluate positive production emails",
			error: error.message
		});
	}
};

const listPositiveProductionEmailLogs = async (req, res) => {
	try {
		const logs = await getPositiveProductionEmailLogs({
			userId: req.params.userId || req.query.userId,
			limit: req.query.limit
		});

		return res.status(200).json({
			success: true,
			message: "Positive production email logs fetched successfully",
			data: logs
		});
	} catch (error) {
		return res.status(400).json({
			success: false,
			message: "Failed to fetch positive production email logs",
			error: error.message
		});
	}
};

const verifyPositiveProductionEmailConfig = async (req, res) => {
	try {
		await verifyGoogleMailConfiguration();
		return res.status(200).json({
			success: true,
			message: "Google mail configuration verified successfully"
		});
	} catch (error) {
		return res.status(500).json({
			success: false,
			message: "Google mail configuration verification failed",
			error: error.message
		});
	}
};

module.exports = {
	triggerPositiveProductionEmails,
	listPositiveProductionEmailLogs,
	verifyPositiveProductionEmailConfig
};
