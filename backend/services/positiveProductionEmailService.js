const mongoose = require("mongoose");
const DailyPrediction = require("../models/DailyPrediction");
const UserData = require("../models/data");
const MonthlyData = require("../models/monthlydata");
const PositiveProductionEmailLog = require("../models/PositiveProductionEmailLog");
const { sendMail, verifyGoogleMailConfiguration } = require("./googleMailService");

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const formatKwh = (value) => {
	const numberValue = Number(value);
	return Number.isFinite(numberValue) ? Number(numberValue.toFixed(2)) : null;
};

const getDateString = (date = new Date()) => {
	if (typeof date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
		return date;
	}
	return new Date(date).toISOString().split("T")[0];
};

const getMonthKey = (dateString) => MONTHS[new Date(`${dateString}T00:00:00.000Z`).getUTCMonth()];

const escapeHtml = (value) => String(value ?? "")
	.replace(/&/g, "&amp;")
	.replace(/</g, "&lt;")
	.replace(/>/g, "&gt;")
	.replace(/"/g, "&quot;")
	.replace(/'/g, "&#39;");

const buildEmailContent = ({ user, prediction, monthlyTarget }) => {
	const siteName = user.name || "your solar site";
	const predictedKwh = formatKwh(prediction.predicted_kwh);
	const actualKwh = formatKwh(prediction.inverter_real_time_kwh);
	const differenceKwh = formatKwh(prediction.difference_kwh ?? (actualKwh - predictedKwh));
	const targetLine = monthlyTarget
		? `At this pace, your system is well positioned to achieve the projected monthly target of ${monthlyTarget} kWh.`
		: "At this pace, your system is well positioned to achieve the projected target for the month.";

	const subject = `Great news: ${siteName} beat today's solar prediction`;
	const text = [
		`Hi ${user.name || "there"},`,
		"",
		"Congratulations! Your inverter production is greater than the predicted production today.",
		`Predicted production: ${predictedKwh} kWh`,
		`Actual inverter production: ${actualKwh} kWh`,
		`Extra production: ${differenceKwh} kWh`,
		"",
		targetLine,
		"",
		"Keep enjoying the sunshine,",
		"SolarWizer"
	].join("\n");

	const html = `
		<div style="font-family:Arial,sans-serif;line-height:1.55;color:#18212f">
			<p>Hi ${escapeHtml(user.name || "there")},</p>
			<p><strong>Congratulations!</strong> Your inverter production is greater than the predicted production today.</p>
			<ul>
				<li>Predicted production: <strong>${predictedKwh} kWh</strong></li>
				<li>Actual inverter production: <strong>${actualKwh} kWh</strong></li>
				<li>Extra production: <strong>${differenceKwh} kWh</strong></li>
			</ul>
			<p>${escapeHtml(targetLine)}</p>
			<p>Keep enjoying the sunshine,<br/>SolarWizer</p>
		</div>
	`;

	return { subject, text, html, predictedKwh, actualKwh, differenceKwh };
};

const shouldNotifyPrediction = (prediction) => {
	const predictedKwh = formatKwh(prediction.predicted_kwh);
	const actualKwh = formatKwh(prediction.inverter_real_time_kwh);
	return predictedKwh !== null && actualKwh !== null && actualKwh > predictedKwh;
};

const createOrReuseLog = async ({ user, prediction, content, monthlyTarget, force }) => {
	const existing = await PositiveProductionEmailLog.findOne({
		userId: user._id,
		date: prediction.date
	});

	if (existing?.status === "SENT" && !force) {
		return { log: existing, shouldSend: false, reason: "Email already sent for this user and date" };
	}

	if (existing) {
		existing.status = "PROCESSING";
		existing.recipientEmail = user.email;
		existing.subject = content.subject;
		existing.dailyPredictionId = prediction._id;
		existing.predicted_kwh = content.predictedKwh;
		existing.actual_kwh = content.actualKwh;
		existing.difference_kwh = content.differenceKwh;
		existing.projected_monthly_kwh = monthlyTarget;
		existing.error = "";
		await existing.save();
		return { log: existing, shouldSend: true };
	}

	try {
		const log = await PositiveProductionEmailLog.create({
			userId: user._id,
			dailyPredictionId: prediction._id,
			date: prediction.date,
			recipientEmail: user.email,
			subject: content.subject,
			status: "PROCESSING",
			predicted_kwh: content.predictedKwh,
			actual_kwh: content.actualKwh,
			difference_kwh: content.differenceKwh,
			projected_monthly_kwh: monthlyTarget
		});

		return { log, shouldSend: true };
	} catch (error) {
		if (error.code === 11000) {
			return { log: null, shouldSend: false, reason: "Email send is already being processed" };
		}
		throw error;
	}
};

const sendPositiveProductionEmailForPrediction = async ({ prediction, force = false, dryRun = false }) => {
	const user = await UserData.findById(prediction.userId).lean();
	if (!user) {
		return { status: "skipped", reason: "User not found", userId: String(prediction.userId), date: prediction.date };
	}

	if (!user.email || !EMAIL_REGEX.test(user.email)) {
		return { status: "skipped", reason: "Valid user email not found", userId: String(user._id), date: prediction.date };
	}

	if (!shouldNotifyPrediction(prediction)) {
		return { status: "skipped", reason: "Inverter production is not greater than predicted production", userId: String(user._id), date: prediction.date };
	}

	const monthKey = getMonthKey(prediction.date);
	const monthlyReport = await MonthlyData.findOne({ userDataId: user._id }).lean();
	const monthlyTarget = formatKwh(monthlyReport?.monthly_energy_kwh?.[monthKey]);
	const content = buildEmailContent({ user, prediction, monthlyTarget });

	if (dryRun) {
		return {
			status: "dry_run",
			userId: String(user._id),
			email: user.email,
			date: prediction.date,
			subject: content.subject,
			predicted_kwh: content.predictedKwh,
			actual_kwh: content.actualKwh,
			difference_kwh: content.differenceKwh,
			projected_monthly_kwh: monthlyTarget
		};
	}

	const { log, shouldSend, reason } = await createOrReuseLog({
		user,
		prediction,
		content,
		monthlyTarget,
		force
	});

	if (!shouldSend) {
		return { status: "skipped", reason, userId: String(user._id), date: prediction.date };
	}

	try {
		const sendResult = await sendMail({
			to: user.email,
			subject: content.subject,
			text: content.text,
			html: content.html
		});

		log.status = "SENT";
		log.messageId = sendResult.messageId || "";
		log.sentAt = new Date();
		log.error = "";
		await log.save();

		return {
			status: "sent",
			userId: String(user._id),
			email: user.email,
			date: prediction.date,
			messageId: log.messageId
		};
	} catch (error) {
		log.status = "FAILED";
		log.error = error.message;
		await log.save();
		return {
			status: "failed",
			userId: String(user._id),
			email: user.email,
			date: prediction.date,
			error: error.message
		};
	}
};

const sendPositiveProductionEmails = async (options = {}) => {
	const date = getDateString(options.date || new Date());
	const query = { date };

	if (options.userId) {
		if (!mongoose.Types.ObjectId.isValid(options.userId)) {
			throw new Error("Invalid user ID format");
		}
		query.userId = options.userId;
	}

	const predictions = await DailyPrediction.find(query).lean();
	const result = {
		date,
		totalPredictions: predictions.length,
		sent: 0,
		skipped: 0,
		failed: 0,
		dryRun: Boolean(options.dryRun),
		results: []
	};

	for (const prediction of predictions) {
		const item = await sendPositiveProductionEmailForPrediction({
			prediction,
			force: Boolean(options.force),
			dryRun: Boolean(options.dryRun)
		});

		result.results.push(item);
		if (item.status === "sent") result.sent += 1;
		else if (item.status === "failed") result.failed += 1;
		else result.skipped += 1;
	}

	return result;
};

const getPositiveProductionEmailLogs = async ({ userId, limit = 100 } = {}) => {
	const query = {};
	if (userId) {
		if (!mongoose.Types.ObjectId.isValid(userId)) {
			throw new Error("Invalid user ID format");
		}
		query.userId = userId;
	}

	const cappedLimit = Math.min(Math.max(Number(limit) || 100, 1), 500);
	return PositiveProductionEmailLog.find(query).sort({ createdAt: -1 }).limit(cappedLimit).lean();
};

module.exports = {
	sendPositiveProductionEmails,
	getPositiveProductionEmailLogs,
	verifyGoogleMailConfiguration
};
