const isFiniteNumber = (value) => Number.isFinite(Number(value));

const parseKwhFromPayload = (payload = {}) => {
	const candidates = [
		payload?.generation?.today_kwh,
		payload?.today_energy_kwh,
		payload?.today_kwh,
		payload?.generation,
		payload?.energy
	];

	for (const candidate of candidates) {
		if (isFiniteNumber(candidate)) {
			return Number(candidate).toFixed(2);
		}
	}

	return "N/A";
};

const buildTelemetryUrl = ({ inverterSerialNumber, siteId, baseUrl }) => {
	const serial = String(inverterSerialNumber || "").trim();
	const site = String(siteId || "").trim();

	if (site) {
		return new URL(`/solaredge/${encodeURIComponent(site)}`, baseUrl);
	}

	if (serial) {
		return new URL(`/gen/${encodeURIComponent(serial)}`, baseUrl);
	}

	return null;
};

async function fetchTelemetryValue(telemetryUrl, fetchJsonWithTimeout) {
	const telemetryResponse = await fetchJsonWithTimeout(telemetryUrl.toString());
	const value = parseKwhFromPayload(telemetryResponse);
	return value === "N/A" ? null : value;
}

async function getTodayInverterGeneration({ inverterSerialNumber, siteId, fetchJsonWithTimeout, baseUrl, inverter_serial_number, site_id }) {
	const prioritizedSources = [
		{ inverterSerialNumber: siteId ?? site_id ?? "", siteId: siteId ?? site_id ?? "" },
		{ inverterSerialNumber: inverterSerialNumber ?? inverter_serial_number ?? "", siteId: "" }
	];

	for (const source of prioritizedSources) {
		const telemetryUrl = buildTelemetryUrl({
			inverterSerialNumber: source.inverterSerialNumber,
			siteId: source.siteId,
			baseUrl
		});

		if (!telemetryUrl) {
			continue;
		}

		try {
			const value = await fetchTelemetryValue(telemetryUrl, fetchJsonWithTimeout);
			if (value) {
				return value;
			}
		} catch (error) {
			// Try the next identifier if the preferred lookup fails.
		}
	}

	return "N/A";
}

module.exports = {
	getTodayInverterGeneration
};