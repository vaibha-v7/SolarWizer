import { useState } from "react";
import { severityMeta, getFriendlyRecommendation } from "./alertCopy";

const formatAge = (value) => {
	if (!value) return "";
	const date = new Date(value);
	if (Number.isNaN(date.getTime())) return "";
	
	const diffMs = new Date() - date;
	if (diffMs < 0) return "Just now";
	
	const diffMins = Math.floor(diffMs / 60000);
	const diffHrs = Math.floor(diffMins / 60);
	const diffDays = Math.floor(diffHrs / 24);
	
	if (diffDays > 0) {
		return `${diffDays} Day${diffDays > 1 ? "s" : ""}`;
	}
	if (diffHrs > 0) {
		return `${diffHrs} Hour${diffHrs > 1 ? "s" : ""}`;
	}
	if (diffMins > 0) {
		return `${diffMins} Minute${diffMins > 1 ? "s" : ""}`;
	}
	return "< 1 Min";
};

const formatTimeAgo = (value) => {
	if (!value) return "Unknown";
	const date = new Date(value);
	if (Number.isNaN(date.getTime())) return "Unknown";
	
	const diffMs = new Date() - date;
	if (diffMs < 0) return "Just now";
	
	const diffMins = Math.floor(diffMs / 60000);
	const diffHrs = Math.floor(diffMins / 60);
	const diffDays = Math.floor(diffHrs / 24);
	
	if (diffDays > 0) return `${diffDays} Days Ago`;
	if (diffHrs > 0) return `${diffHrs} Hours Ago`;
	if (diffMins > 0) return `${diffMins} Minutes Ago`;
	return "Just now";
};

const siteLabel = (name, userId) => {
	const label = String(name || "").trim();
	if (label) return label;
	const id = String(userId || "unassigned");
	if (id === "unassigned") return "Unknown Site";
	return `Deleted Site (${id.slice(-6).toUpperCase()})`;
};

const EmptyAlerts = ({ message }) => (
	<tr>
		<td colSpan="7" className="px-5 py-8 text-center text-sm font-bold text-slate-500">
			{message}
		</td>
	</tr>
);

const GenerationRow = ({ alert }) => {
	const [expanded, setExpanded] = useState(false);
	
	const meta = severityMeta[alert.severity] || severityMeta.HEALTHY;
	
	const expected = alert.expected_output_kwh ? Number(alert.expected_output_kwh).toFixed(1) : null;
	const actual = alert.actual_output_kwh !== undefined && alert.actual_output_kwh !== null ? Number(alert.actual_output_kwh).toFixed(1) : null;
	const rawDiff = alert.difference_kwh ? Number(alert.difference_kwh) : null;
	const diffText = rawDiff !== null ? (rawDiff > 0 ? `+${rawDiff.toFixed(1)} kW` : `${rawDiff.toFixed(1)} kW`) : "—";
	let diffColor = "text-slate-500";
	let diffIcon = "";
	if (rawDiff !== null) {
		if (rawDiff < 0) {
			diffColor = "text-rose-600";
		} else if (rawDiff > 0) {
			diffColor = "text-emerald-600";
		}
	}

	const age = alert.alert_days_10d > 0 ? `${alert.alert_days_10d} Day${alert.alert_days_10d > 1 ? "s" : ""}` : "< 1 Day";
	const lastTelemetry = formatTimeAgo(alert.last_telemetry);
	
	let reason = "Actual output lower than predicted output.";
	if (rawDiff !== null && rawDiff >= 0) {
		reason = "Exceeding expectation.";
	} else if (rawDiff !== null && rawDiff < 0) {
		reason = "Underperforming.";
	}
	
	const recommendation = getFriendlyRecommendation(
		Array.isArray(alert.maintenance_recommendations) && alert.maintenance_recommendations.length
			? alert.maintenance_recommendations[0]
			: ""
	);

	return (
		<>
			<tr className="border-b border-slate-100 hover:bg-slate-50/50 transition">
				<td className="px-4 py-3 text-sm font-bold text-slate-900">
					{siteLabel(alert.user_name || alert.site_name, alert.user_id)}
				</td>
				<td className="px-4 py-3 text-sm font-medium text-slate-700">
					{expected ? `${expected} kW` : "—"}
				</td>
				<td className="px-4 py-3 text-sm font-medium text-slate-700">
					{actual ? `${actual} kW` : "—"}
				</td>
				<td className={`px-4 py-3 text-sm font-semibold ${diffColor}`}>
					{diffText}
				</td>
				<td className="px-4 py-3 text-sm font-medium text-slate-500">
					{age}
				</td>
				<td className="px-4 py-3">
					<span className={`inline-flex px-2 py-0.5 text-xs font-semibold rounded-full ${meta.color}`}>
						{meta.label}
					</span>
				</td>
				<td className="px-4 py-3 text-right">
					<button 
						onClick={() => setExpanded(!expanded)}
						className="text-xs font-bold text-indigo-600 hover:text-indigo-800 transition"
					>
						{expanded ? "Hide Details" : "View Details"}
					</button>
				</td>
			</tr>
			{expanded && (
				<tr className="bg-slate-50/80 border-b border-slate-100">
					<td colSpan="7" className="px-5 py-4">
						<div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
							<div>
								<p className="font-bold text-slate-500 text-[10px] uppercase tracking-wider">Reason</p>
								<p className="mt-0.5 font-semibold text-slate-800">{reason}</p>
							</div>
							<div>
								<p className="font-bold text-slate-500 text-[10px] uppercase tracking-wider">Last Telemetry</p>
								<p className="mt-0.5 font-semibold text-slate-800">{lastTelemetry}</p>
							</div>
							<div className="col-span-1 md:col-span-2">
								<p className="font-bold text-slate-500 text-[10px] uppercase tracking-wider">Recommended Action</p>
								<p className="mt-0.5 font-semibold text-slate-800">{recommendation || "Inspect inverter."}</p>
							</div>
						</div>
					</td>
				</tr>
			)}
		</>
	);
};

const ConnectivityRow = ({ alert }) => {
	const [expanded, setExpanded] = useState(false);
	const meta = severityMeta[alert.severity] || severityMeta.HEALTHY;
	const age = alert.alert_days_10d > 0 ? `${alert.alert_days_10d} Day${alert.alert_days_10d > 1 ? "s" : ""}` : "< 1 Day";
	const lastTelemetry = formatTimeAgo(alert.last_telemetry);
	
	const recommendation = getFriendlyRecommendation(
		Array.isArray(alert.maintenance_recommendations) && alert.maintenance_recommendations.length
			? alert.maintenance_recommendations[0]
			: "Verify inverter connectivity and local network."
	);

	return (
		<>
			<tr className="border-b border-slate-100 hover:bg-slate-50/50 transition">
				<td className="px-4 py-3 text-sm font-bold text-slate-900">
					{siteLabel(alert.user_name || alert.site_name, alert.user_id)}
				</td>
				<td className="px-4 py-3 text-sm font-bold text-slate-500">Not Connected</td>
				<td className="px-4 py-3 text-sm font-medium text-slate-500">{age}</td>
				<td className="px-4 py-3">
					<span className={`inline-flex px-2 py-0.5 text-xs font-semibold rounded-full ${meta.color}`}>
						{meta.label}
					</span>
				</td>
				<td className="px-4 py-3 text-right">
					<button 
						onClick={() => setExpanded(!expanded)}
						className="text-xs font-bold text-indigo-600 hover:text-indigo-800 transition"
					>
						{expanded ? "Hide Details" : "View Details"}
					</button>
				</td>
			</tr>
			{expanded && (
				<tr className="bg-slate-50/80 border-b border-slate-100">
					<td colSpan="5" className="px-5 py-4">
						<div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
							<div>
								<p className="font-bold text-slate-500 text-[10px] uppercase tracking-wider">Reason</p>
								<p className="mt-0.5 font-semibold text-slate-800">No telemetry received.</p>
							</div>
							<div>
								<p className="font-bold text-slate-500 text-[10px] uppercase tracking-wider">Last Telemetry</p>
								<p className="mt-0.5 font-semibold text-slate-800">{lastTelemetry}</p>
							</div>
							<div className="col-span-1 md:col-span-2">
								<p className="font-bold text-slate-500 text-[10px] uppercase tracking-wider">Recommended Action</p>
								<p className="mt-0.5 font-semibold text-slate-800">{recommendation}</p>
							</div>
						</div>
					</td>
				</tr>
			)}
		</>
	);
};

const SOICActiveAlerts = ({ alerts = [], fullPage = false }) => {
	const activeList = alerts; // Backend already filters these down to non-HEALTHY alerts.
	
	const connectivityAlerts = activeList.filter(a => a.status === "Not Connected");
	const generationAlerts = activeList.filter(a => a.status !== "Not Connected");

	return (
		<div className="space-y-6">
			{/* Generation Alerts Table */}
			<div className="rounded-2xl border border-slate-200/80 bg-white/88 shadow-sm overflow-hidden">
				<div className="border-b border-slate-200/80 bg-slate-50/50 px-5 py-4">
					<h2 className="text-sm font-bold text-slate-900 tracking-wide uppercase">ACTIVE GENERATION ISSUES</h2>
					<p className="text-xs text-slate-500 mt-1">Sites currently sending telemetry but underperforming.</p>
				</div>
				<div className="w-full overflow-x-auto">
					<table className="w-full text-left border-collapse min-w-[800px]">
						<thead>
							<tr className="border-b border-slate-200/80 bg-slate-50">
								<th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Site Name</th>
								<th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Expected</th>
								<th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Actual</th>
								<th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Diff</th>
								<th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Alert Age</th>
								<th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Severity</th>
								<th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500 text-right">Action</th>
							</tr>
						</thead>
						<tbody>
							{generationAlerts.length === 0 ? (
								<EmptyAlerts message="No active generation issues." />
							) : (
								generationAlerts.map((alert) => (
									<GenerationRow key={alert._id || `${alert.user_id}-${alert.title}`} alert={alert} />
								))
							)}
						</tbody>
					</table>
				</div>
			</div>

			{/* Connectivity Alerts Table */}
			<div className="rounded-2xl border border-slate-200/80 bg-white/88 shadow-sm overflow-hidden">
				<div className="border-b border-slate-200/80 bg-slate-50/50 px-5 py-4">
					<h2 className="text-sm font-bold text-slate-900 tracking-wide uppercase">CONNECTIVITY ISSUES</h2>
					<p className="text-xs text-slate-500 mt-1">Sites that have stopped sending telemetry.</p>
				</div>
				<div className="w-full overflow-x-auto">
					<table className="w-full text-left border-collapse min-w-[600px]">
						<thead>
							<tr className="border-b border-slate-200/80 bg-slate-50">
								<th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Site Name</th>
								<th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Status</th>
								<th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Alert Age</th>
								<th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Severity</th>
								<th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500 text-right">Action</th>
							</tr>
						</thead>
						<tbody>
							{connectivityAlerts.length === 0 ? (
								<EmptyAlerts message="No active connectivity issues." />
							) : (
								connectivityAlerts.map((alert) => (
									<ConnectivityRow key={alert._id || `${alert.user_id}-${alert.title}`} alert={alert} />
								))
							)}
						</tbody>
					</table>
				</div>
			</div>
		</div>
	);
};

export default SOICActiveAlerts;
