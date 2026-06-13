import { getSimpleAlertText } from "./alertCopy";

const siteLabel = (name, value) => {
	const label = String(name || "").trim();
	if (label) return label;

	const id = String(value || "unknown");
	if (id === "unknown") return "Site Unknown";
	return `Deleted Site (${id.slice(-6).toUpperCase()})`;
};

const formatDate = (value) => {
	if (!value) return "Recently";
	const date = new Date(value);
	if (Number.isNaN(date.getTime())) return "Recently";
	return date.toLocaleDateString([], { month: "short", day: "numeric" });
};

const formatDuration = (start, end) => {
	if (!start || !end) return "";
	const s = new Date(start);
	const e = new Date(end);
	if (isNaN(s) || isNaN(e)) return "";
	
	const diffMs = e - s;
	if (diffMs <= 0) return "";
	
	const mins = Math.floor(diffMs / 60000);
	const hours = Math.floor(mins / 60);
	const days = Math.floor(hours / 24);
	
	if (days > 0) {
		const remHours = hours % 24;
		return `${days}d ${remHours}h`;
	}
	if (hours > 0) {
		const remMins = mins % 60;
		return `${hours}h ${remMins}m`;
	}
	return `${mins}m`;
};

const SOICRecoveredSites = ({ alerts = [], onSiteClick }) => {
	const recovered = alerts
		.filter((item) => item.status === "AUTO_RESOLVED" || item.status === "RESOLVED")
		.sort((left, right) => new Date(right.resolved_at || right.auto_resolved_at || right.updated_at || 0) - new Date(left.resolved_at || left.auto_resolved_at || left.updated_at || 0))
		.slice(0, 6);

	return (
		<section className="overflow-hidden rounded-2xl border border-blue-200/80 bg-white/90 shadow-sm">
			<div className="flex flex-col gap-2 border-b border-blue-100 bg-gradient-to-r from-blue-50 to-emerald-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
				<div>
					<p className="text-xs font-bold uppercase tracking-[0.14em] text-blue-700">Recovery Log</p>
					<h2 className="mt-1 text-lg font-bold text-slate-900">Recently Recovered Sites</h2>
				</div>
				<span className="self-start rounded-full bg-white px-3 py-1 text-xs font-bold text-blue-700 shadow-sm sm:self-auto">
					{recovered.length} closed
				</span>
			</div>

			<div className="p-4 sm:p-5">
				{recovered.length ? (
					<div className="space-y-3">
						{recovered.map((alert) => {
							const resolvedAt = alert.resolved_at || alert.auto_resolved_at || alert.updated_at;
							const triggeredAt = alert.triggered_at || alert.created_at;
							const duration = formatDuration(triggeredAt, resolvedAt);
							const prefix = alert.status === "AUTO_RESOLVED" ? "Recovered after" : "Manually resolved after";

							return (
								<div key={alert._id || `${alert.user_id}-${alert.title}`} className="rounded-xl border border-blue-100 bg-blue-50/45 p-3">
									<div className="flex items-start justify-between gap-3">
										<div className="min-w-0">
											<button 
												onClick={() => onSiteClick && onSiteClick(alert.user_id)}
												className="truncate text-sm font-bold text-slate-900 hover:text-blue-700 hover:underline transition text-left block"
											>
												{siteLabel(alert.user_name || alert.site_name, alert.user_id)}
											</button>
											<p className="mt-1 text-xs font-semibold text-slate-600">{getSimpleAlertText(alert.short_message || alert.title || "Alert resolved")}</p>
										</div>
										<span className="rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-black text-emerald-700 uppercase tracking-wide">
											{alert.status === "AUTO_RESOLVED" ? "Auto Resolved" : "Manual Resolve"}
										</span>
									</div>
									<div className="mt-3 flex items-center justify-between gap-3 text-xs">
										<span className="font-semibold text-slate-500">
											{duration ? `${prefix} ${duration}` : formatDate(resolvedAt)}
										</span>
										<span className="font-bold text-blue-700">{alert.resolution_reason || "Recovered"}</span>
									</div>
								</div>
							);
						})}
					</div>
				) : (
					<div className="py-8 text-center">
						<div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-xs font-black text-slate-500">
							DONE
						</div>
						<p className="mt-3 text-sm font-bold text-slate-700">No recent recoveries</p>
						<p className="mt-1 text-xs text-slate-500">Resolved alerts will appear here after the scheduler closes them.</p>
					</div>
				)}
			</div>
		</section>
	);
};

export default SOICRecoveredSites;
