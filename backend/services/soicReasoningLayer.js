const safeNumber = (value, fallback = 0) => {
	const parsed = Number(value);
	return Number.isFinite(parsed) ? parsed : fallback;
};

const average = (values = []) => {
	const nums = values.map(Number).filter(Number.isFinite);
	if (!nums.length) return 0;
	return nums.reduce((sum, value) => sum + value, 0) / nums.length;
};

const clamp = (value, min = 0, max = 1) => Math.max(min, Math.min(max, value));

const normalizeRatio = (value, fallback = 0) => {
	const ratio = safeNumber(value, fallback);
	if (ratio > 2) return ratio / 100;
	return ratio;
};

const getSourceConfidence = (latest = {}) => {
	if (latest.data_source === "daily_prediction_inverter") return 0.92;
	if (latest.data_source === "daily_prediction_forecast") return 0.72;
	if (latest.data_source === "monthly_report_baseline") return 0.62;
	return 0.55;
};

const estimateRiskTimeline = ({ latest = {}, trend = {}, baseline = {} }) => {
	const ratio = normalizeRatio(latest.performance_ratio);
	const warningThreshold = normalizeRatio(baseline.warning_threshold, normalizeRatio(baseline.baseline_performance_ratio, 0.9) * 0.92);
	const criticalThreshold = normalizeRatio(baseline.critical_threshold, normalizeRatio(baseline.baseline_performance_ratio, 0.9) * 0.85);
	const slope = safeNumber(trend?.slope);

	if (trend?.projected_days_to_critical !== null && trend?.projected_days_to_critical !== undefined) {
		return Math.max(0, Math.round(safeNumber(trend.projected_days_to_critical)));
	}

	if (ratio <= criticalThreshold) return 0;
	if (ratio <= warningThreshold) return 14;
	if (slope < -0.001) {
		const days = (criticalThreshold - ratio) / slope;
		return Number.isFinite(days) && days >= 0 ? Math.round(days) : 45;
	}

	return null;
};

const buildOperationalReasoning = ({ user = {}, latest = {}, history = [], baseline = {}, trend = {}, monthlyReport = {} }) => {
	const baselineRatio = normalizeRatio(baseline.baseline_performance_ratio, normalizeRatio(latest.site_baseline_ratio, 0.9));
	const warningThreshold = normalizeRatio(baseline.warning_threshold, baselineRatio * 0.92);
	const criticalThreshold = normalizeRatio(baseline.critical_threshold, baselineRatio * 0.85);
	const ratio = normalizeRatio(latest.performance_ratio);
	const driftPercent = baselineRatio > 0 ? ((ratio - baselineRatio) / baselineRatio) * 100 : 0;
	const recentRatios = history.slice(0, 7).map((item) => normalizeRatio(item.performance_ratio)).filter(Number.isFinite);
	const olderRatios = history.slice(7, 30).map((item) => normalizeRatio(item.performance_ratio)).filter(Number.isFinite);
	const recentAverage = average(recentRatios);
	const olderAverage = average(olderRatios);
	const cloud = safeNumber(latest.avg_cloud_cover_percent);
	const temp = safeNumber(latest.avg_temperature_c);
	const hasTelemetrySource = Boolean(String(user.inverterSerialNumber || "").trim() || String(user.siteId || "").trim());
	const hasTelemetry = latest.data_source === "daily_prediction_inverter";
	const causes = [];
	const recommendations = [];
	const evidence = [];

	if (latest.is_data_quality_issue || (hasTelemetrySource && !hasTelemetry)) {
		causes.push("Inverter telemetry gap");
		recommendations.push("Verify inverter connectivity and serial mapping before dispatching field maintenance.");
		evidence.push("inverter telemetry is missing or incomplete");
	}

	if (ratio <= criticalThreshold) {
		causes.push("Critical production loss");
		recommendations.push("Schedule immediate inspection for inverter trip, grid outage, or disconnected strings.");
		evidence.push("performance is below the critical baseline threshold");
	} else if (ratio <= warningThreshold) {
		causes.push("Persistent underperformance");
		recommendations.push("Inspect module cleanliness, string current balance, and inverter efficiency trend.");
		evidence.push("performance is below the warning baseline threshold");
	}

	if (cloud <= 35 && ratio < warningThreshold) {
		causes.push("Soiling or shading under clear weather");
		recommendations.push("Check for new shading, vegetation growth, dust accumulation, or panel obstruction.");
		evidence.push("low output occurred under favorable cloud conditions");
	}

	if (temp >= 40 && ratio < warningThreshold) {
		causes.push("Thermal derating");
		recommendations.push("Review inverter ventilation, ambient heat exposure, and module temperature derating.");
		evidence.push("temperature is high while production is below baseline");
	}

	if (olderAverage && recentAverage && recentAverage < olderAverage * 0.97) {
		causes.push("Gradual degradation trend");
		recommendations.push("Compare the last 30 days against string-level generation and schedule preventive cleaning.");
		evidence.push("recent performance is declining versus the prior window");
	}

	if (safeNumber(monthlyReport.annual_energy_kwh) > 0) {
		evidence.push("monthly report baseline is available");
	}

	if (!causes.length) {
		causes.push("No active degradation pattern");
		recommendations.push("Continue normal monitoring and preserve the 30-day SOIC baseline.");
		evidence.push("latest performance is within the expected baseline band");
	}

	const projectedRiskTimelineDays = estimateRiskTimeline({ latest, trend, baseline });
	const dataQualityBonus = hasTelemetry ? 0.14 : 0;
	const historyBonus = Math.min(0.14, history.length / 30 * 0.14);
	const baselineBonus = baseline?.confidence_level === "high" ? 0.08 : baseline?.confidence_level === "medium" ? 0.05 : 0.02;
	const confidence = clamp(getSourceConfidence(latest) + dataQualityBonus + historyBonus + baselineBonus - (latest.is_data_quality_issue ? 0.12 : 0), 0.45, 0.98);
	const riskLevel = ratio <= criticalThreshold ? "critical" : ratio <= warningThreshold ? "warning" : trend?.trend_direction === "declining" ? "watch" : "stable";

	return {
		confidence_score: Number(confidence.toFixed(2)),
		confidence_distribution: {
			source_quality: Number(getSourceConfidence(latest).toFixed(2)),
			history_depth: Number(historyBonus.toFixed(2)),
			baseline_quality: Number(baselineBonus.toFixed(2)),
			weather_context: cloud || temp ? 0.12 : 0.04
		},
		possible_causes: [...new Set(causes)].slice(0, 5),
		maintenance_recommendations: [...new Set(recommendations)].slice(0, 5),
		projected_risk_timeline_days: projectedRiskTimelineDays,
		risk_level: riskLevel,
		reasoning_summary: `SOIC used ${latest.data_source || "available analytics"}, ${history.length} snapshot(s), weather context, fleet baseline, and report output; evidence: ${evidence.join(", ")}.`,
		baseline_ratio: Number(baselineRatio.toFixed(4)),
		warning_threshold: Number(warningThreshold.toFixed(4)),
		critical_threshold: Number(criticalThreshold.toFixed(4)),
		drift_percent: Number(driftPercent.toFixed(2))
	};
};

module.exports = {
	buildOperationalReasoning
};
