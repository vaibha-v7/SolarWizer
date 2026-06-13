// ─── Alert type → plain English label ───────────────────────────────────────
const friendlyType = {
	"No Real-Time Data": "Not Connected",
	"Data Quality Issue": "Missing Data",
	"Anomaly Detected": "Unusual Reading",
	"Shading Detection": "Needs Inspection",
	"Thermal Issue": "Too Hot",
	"Persistent Underperformance": "Low Output",
	"Sudden Production Drop": "Production Dropped",
	"Performance Drift": "Slowly Declining",
	"Weather Mismatch": "Clear Day, Low Output",
	"Site Offline": "Site Offline",
	"Recovery Alert": "Back to Normal"
};

// ─── Short message → plain English ───────────────────────────────────────────
const friendlyMessage = {
	"Real-time inverter data not available": "Live data isn't coming in from this site yet",
	"No real-time data available": "Live data isn't coming in from this site yet",
	"Real-time inverter data not available - This site needs to be configured first.":
		"This site hasn't been connected yet — set it up to start monitoring",
	"Production is significantly below expected": "Solar output dropped sharply — needs urgent attention",
	"Production has been low for multiple days": "Output has been lower than expected for several days",
	"Good weather but low output": "It's a sunny day but this site isn't producing enough",
	"Panels may need cleaning or inspection": "Panels might be dirty, shaded, or blocked",
	"High temperature affecting output": "It's very hot today, which is reducing output",
	"Unexpected performance pattern detected": "Something unusual is happening with this site's output",
	"Production trend is going down": "Output has been slowly getting worse over time",
	"No power output detected": "Site is showing zero production — may be offline",
	"Performance has recovered": "This site is back to normal output levels"
};

// ─── Recommendation → plain English ──────────────────────────────────────────
const friendlyRecommendation = {
	"Continue normal monitoring and preserve the 30-day SOIC baseline.":
		"No action needed — keep monitoring as usual",
	"Schedule immediate inspection for inverter trip, grid outage, or disconnected strings.":
		"Schedule a visit to check the inverter and panel connections",
	"Verify inverter connectivity and serial mapping before dispatching field maintenance.":
		"Check that the inverter is connected and reporting correctly"
};

export const getFriendlyAlertType = (alertType) => {
	const key = String(alertType || "").trim();
	return friendlyType[key] || key || "General Alert";
};

export const getFriendlyMessage = (text) => {
	const value = String(text || "").trim();
	if (!value) return "";

	// Direct match first
	if (friendlyMessage[value]) return friendlyMessage[value];

	// Partial match
	for (const [source, replacement] of Object.entries(friendlyMessage)) {
		if (value.includes(source)) return replacement;
	}

	return value;
};

export const getFriendlyRecommendation = (text) => {
	const value = String(text || "").trim();
	if (!value) return "";
	if (friendlyRecommendation[value]) return friendlyRecommendation[value];
	for (const [source, replacement] of Object.entries(friendlyRecommendation)) {
		if (value.includes(source)) return replacement;
	}
	return value;
};

export const severityMeta = {
	CRITICAL: { label: "Critical", color: "bg-red-50 text-red-700 ring-1 ring-inset ring-red-200/50" },
	HIGH: { label: "High", color: "bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-200/50" },
	MEDIUM: { label: "Medium", color: "bg-yellow-50 text-yellow-700 ring-1 ring-inset ring-yellow-200/50" },
	LOW: { label: "Low", color: "bg-slate-50 text-slate-700 ring-1 ring-inset ring-slate-200/50" },
	HEALTHY: { label: "Healthy", color: "bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200/50" }
};

// Legacy exports kept for any files that still import the old names
export const getSimpleAlertType = getFriendlyAlertType;
export const getSimpleAlertText = getFriendlyMessage;
