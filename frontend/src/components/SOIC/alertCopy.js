const simplifiedTypeByAlert = {
	"Data Quality Issue": "No Real-Time Data",
	"Anomaly Detected": "Unexpected Pattern",
	"Shading Detection": "Panel Inspection",
	"Thermal Issue": "Heat Impact"
};

const simplifiedText = {
	"Inverter telemetry missing": "No real-time data available",
	"SOIC anomaly score is": "Unexpected performance pattern detected",
	"Inverter generation dropped": "Production is significantly below expected",
	"Unexplained low output under favorable weather suggests shading, soiling, or obstruction.": "Panels may need cleaning or inspection",
	"Thermal-related production drop": "High temperature affecting output",
	"Telemetry gap detected": "No real-time data available",
	"Performance outlier identified": "Unexpected performance pattern detected",
	"Potential shading impact detected": "Panels may need cleaning or inspection",
	"Emergency drop in production": "Production is significantly below expected"
};

export const getSimpleAlertType = (alertType) => simplifiedTypeByAlert[String(alertType || "").trim()] || String(alertType || "General");

export const getSimpleAlertText = (text) => {
	const value = String(text || "").trim();
	if (!value) return "";

	for (const [source, replacement] of Object.entries(simplifiedText)) {
		if (value === source || value.includes(source)) return replacement;
	}

	return value;
};
