import { useState } from "react";

const formatAgeDays = (value) => {
	if (!value) return "0 Days";
	const date = new Date(value);
	if (Number.isNaN(date.getTime())) return "0 Days";
	
	const diffMs = new Date() - date;
	if (diffMs < 0) return "0 Days";
	
	const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
	return `${diffDays} Day${diffDays !== 1 ? "s" : ""}`;
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
	const id = String(userId || "unknown");
	if (id === "unknown") return "Unknown Site";
	return `Deleted Site (${id.slice(-6).toUpperCase()})`;
};

const SOICCriticalSites = ({ alerts = [], fullPage = false }) => {
	const criticalAlerts = alerts
		.filter((item) => item.severity === "CRITICAL")
		.slice(0, fullPage ? alerts.length : 5);

	return (
		<div className="rounded-2xl border border-rose-200/80 bg-white/88 shadow-sm overflow-hidden w-full overflow-x-auto">
			<div className="border-b border-rose-200/80 bg-rose-50/50 px-5 py-4">
				<h2 className="text-sm font-bold text-rose-900 tracking-wide uppercase">CRITICAL SITES</h2>
				<p className="text-xs text-rose-600/80 mt-1">Sites in a critical state requiring immediate action.</p>
			</div>
			<table className="w-full text-left border-collapse min-w-[800px]">
				<thead>
					<tr className="border-b border-rose-100 bg-rose-50/30">
						<th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-rose-700">Site Name</th>
						<th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-rose-700">Alert Days (10d)</th>
						<th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-rose-700">Status</th>
						<th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-rose-700">Expected Output</th>
						<th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-rose-700">Actual Output</th>
						<th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-rose-700">Last Telemetry</th>
					</tr>
				</thead>
				<tbody>
					{criticalAlerts.length === 0 ? (
						<tr>
							<td colSpan="6" className="px-5 py-12 text-center text-sm font-bold text-slate-500">
								No critical sites at this time.
							</td>
						</tr>
					) : (
						criticalAlerts.map((alert) => {
							const status = alert.status || "Underperforming";
							const isConnectivity = status === "Not Connected";
							const expected = alert.expected_output_kwh ? Number(alert.expected_output_kwh).toFixed(1) : null;
							const actual = alert.actual_output_kwh !== undefined && alert.actual_output_kwh !== null ? Number(alert.actual_output_kwh).toFixed(1) : null;
							
							const ageDays = alert.alert_days_10d || 0;
							const lastTelemetry = formatTimeAgo(alert.last_telemetry);

							return (
								<tr key={alert.user_id} className="border-b border-slate-100 hover:bg-rose-50/30 transition">
									<td className="px-4 py-3 text-sm font-bold text-slate-900">
										{siteLabel(alert.user_name || alert.site_name, alert.user_id)}
									</td>
									<td className="px-4 py-3 text-sm font-medium text-slate-700">
										{ageDays}
									</td>
									<td className="px-4 py-3 text-sm font-semibold text-rose-600">
										{status}
									</td>
									<td className="px-4 py-3 text-sm font-medium text-slate-700">
										{isConnectivity || !expected ? "—" : `${expected} kW`}
									</td>
									<td className="px-4 py-3 text-sm font-medium text-slate-700">
										{isConnectivity || !actual ? "—" : `${actual} kW`}
									</td>
									<td className="px-4 py-3 text-sm font-medium text-slate-500">
										{lastTelemetry}
									</td>
								</tr>
							);
						})
					)}
				</tbody>
			</table>
		</div>
	);
};

export default SOICCriticalSites;
