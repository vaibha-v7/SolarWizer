import { useState } from "react";

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

const SOICLiveSites = ({ sites = [] }) => {
	return (
		<div className="rounded-2xl border border-slate-200/80 bg-white/88 shadow-sm overflow-hidden mt-6">
			<div className="border-b border-slate-200/80 bg-slate-50/50 px-5 py-4 flex justify-between items-center">
				<div>
					<h2 className="text-sm font-bold text-slate-900 tracking-wide uppercase">LIVE CONNECTED SITES</h2>
					<p className="text-xs text-slate-500 mt-1">Real-time generation data for all currently connected sites.</p>
				</div>
			</div>
			<div className="w-full overflow-x-auto">
				<table className="w-full text-left border-collapse min-w-[800px]">
					<thead>
						<tr className="border-b border-slate-200/80 bg-slate-50">
							<th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Site Name</th>
							<th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Predicted</th>
							<th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Actual</th>
							<th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Difference</th>
							<th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500 text-right">Last Telemetry</th>
						</tr>
					</thead>
					<tbody>
						{sites.length === 0 ? (
							<tr>
								<td colSpan="5" className="px-5 py-8 text-center text-sm font-bold text-slate-500">
									No live connected sites found.
								</td>
							</tr>
						) : (
							sites.map((site) => {
								const diffVal = Number(site.difference_kwh || 0);
								const isPositive = diffVal >= 0;
								return (
									<tr key={site.user_id} className="border-b border-slate-100 hover:bg-slate-50/50 transition">
										<td className="px-4 py-3 text-sm font-bold text-slate-900">
											{site.site_name || site.user_name || "Unknown Site"}
										</td>
										<td className="px-4 py-3 text-sm font-medium text-slate-700">
											{site.predicted_generation_kwh ? `${Number(site.predicted_generation_kwh).toFixed(1)} kW` : "—"}
										</td>
										<td className="px-4 py-3 text-sm font-medium text-slate-700">
											{site.current_generation_kwh ? `${Number(site.current_generation_kwh).toFixed(1)} kW` : "—"}
										</td>
										<td className={`px-4 py-3 text-sm font-semibold ${isPositive ? "text-emerald-600" : "text-rose-600"}`}>
											{isPositive ? "+" : ""}{diffVal.toFixed(1)} kW
										</td>
										<td className="px-4 py-3 text-sm font-medium text-slate-500 text-right">
											{formatTimeAgo(site.last_telemetry)}
										</td>
									</tr>
								);
							})
						)}
					</tbody>
				</table>
			</div>
		</div>
	);
};

export default SOICLiveSites;
