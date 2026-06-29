const nodemailer = require("nodemailer");

let cachedTransporter;

const required = (name) => {
	const value = process.env[name];
	if (!value || !String(value).trim()) {
		throw new Error(`${name} is required for Google email delivery`);
	}
	return String(value).trim();
};

const getFromAddress = () => {
	const from = process.env.GOOGLE_MAIL_FROM || process.env.MAIL_FROM || process.env.GOOGLE_MAIL_USER;
	if (!from || !String(from).trim()) {
		throw new Error("GOOGLE_MAIL_FROM, MAIL_FROM, or GOOGLE_MAIL_USER is required for Google email delivery");
	}
	return String(from).trim();
};

const buildGoogleAuth = () => {
	const user = required("GOOGLE_MAIL_USER");
	const appPassword = process.env.GOOGLE_MAIL_APP_PASSWORD || process.env.GMAIL_APP_PASSWORD;

	if (appPassword) {
		return {
			user,
			pass: appPassword
		};
	}

	return {
		type: "OAuth2",
		user,
		clientId: required("GOOGLE_MAIL_CLIENT_ID"),
		clientSecret: required("GOOGLE_MAIL_CLIENT_SECRET"),
		refreshToken: required("GOOGLE_MAIL_REFRESH_TOKEN"),
		accessToken: process.env.GOOGLE_MAIL_ACCESS_TOKEN || undefined
	};
};

const createTransporter = () => nodemailer.createTransport({
	service: "gmail",
	auth: buildGoogleAuth(),
	pool: process.env.GOOGLE_MAIL_POOL !== "false",
	maxConnections: Number(process.env.GOOGLE_MAIL_MAX_CONNECTIONS || 3),
	maxMessages: Number(process.env.GOOGLE_MAIL_MAX_MESSAGES || 100),
	connectionTimeout: Number(process.env.GOOGLE_MAIL_CONNECTION_TIMEOUT_MS || 30000),
	greetingTimeout: Number(process.env.GOOGLE_MAIL_GREETING_TIMEOUT_MS || 15000),
	socketTimeout: Number(process.env.GOOGLE_MAIL_SOCKET_TIMEOUT_MS || 30000)
});

const getTransporter = () => {
	if (!cachedTransporter) {
		cachedTransporter = createTransporter();
	}
	return cachedTransporter;
};

const sendMail = async ({ to, subject, text, html }) => {
	if (!to || !subject || (!text && !html)) {
		throw new Error("to, subject, and text or html are required to send mail");
	}

	const transporter = getTransporter();
	return transporter.sendMail({
		from: getFromAddress(),
		to,
		subject,
		text,
		html
	});
};

const verifyGoogleMailConfiguration = async () => {
	const transporter = getTransporter();
	return transporter.verify();
};

module.exports = {
	sendMail,
	verifyGoogleMailConfiguration
};
