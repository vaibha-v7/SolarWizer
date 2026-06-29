const { DateTime } = require("luxon");

const TIMEZONE = process.env.DAILY_PREDICTION_TIMEZONE || "Asia/Kolkata";
const EVALUATION_CUTOFF_HOUR = Number(process.env.SOIC_EVALUATION_CUTOFF_HOUR || 19);
const EVALUATION_CUTOFF_MINUTE = Number(process.env.SOIC_EVALUATION_CUTOFF_MINUTE || 0);

const getNowInTimezone = () => DateTime.now().setZone(TIMEZONE);

const SOLAR_BUSINESS_START_HOUR = Number(process.env.SOLAR_BUSINESS_START_HOUR || 6);

const getTodayDateString = () => {
	const now = getNowInTimezone();
	if (now.hour < SOLAR_BUSINESS_START_HOUR) {
		return now.minus({ days: 1 }).toISODate();
	}
	return now.toISODate();
};

const getDateDaysAgo = (daysAgo) => {
	const now = getNowInTimezone();
	const baseDate = now.hour < SOLAR_BUSINESS_START_HOUR ? now.minus({ days: 1 }) : now;
	return baseDate.minus({ days: daysAgo }).toISODate();
};

const normalizeDateString = (date) => {
	if (!date) return getTodayDateString();
	if (typeof date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(date)) return date;
	return DateTime.fromJSDate(new Date(date), { zone: TIMEZONE }).toISODate();
};

const isEvaluationCutoffReached = ({ date = getTodayDateString(), now = getNowInTimezone() } = {}) => {
	const businessDate = DateTime.fromISO(normalizeDateString(date), { zone: TIMEZONE });
	const current = DateTime.isDateTime(now) ? now.setZone(TIMEZONE) : DateTime.fromJSDate(new Date(now), { zone: TIMEZONE });

	if (businessDate < current.startOf("day")) return true;
	if (businessDate > current.startOf("day")) return false;

	const cutoff = current.set({
		hour: EVALUATION_CUTOFF_HOUR,
		minute: EVALUATION_CUTOFF_MINUTE,
		second: 0,
		millisecond: 0
	});

	return current >= cutoff;
};

module.exports = {
	TIMEZONE,
	EVALUATION_CUTOFF_HOUR,
	EVALUATION_CUTOFF_MINUTE,
	getNowInTimezone,
	getTodayDateString,
	getDateDaysAgo,
	normalizeDateString,
	isEvaluationCutoffReached
};
