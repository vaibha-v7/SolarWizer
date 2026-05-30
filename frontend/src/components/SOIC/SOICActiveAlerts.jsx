import { getFriendlyAlertType, getFriendlyMessage, getFriendlyRecommendation, priorityMeta } from "./alertCopy";

const priorityRank = { P5: 5, P4: 4, P3: 3, P2: 2, P1: 1, P0: 0 };

const formatDate = (value) => {
	if (!value) return "";
	const date = new Date(value);
	if (Number.isNaN(date.getTime())) return "";
	const today = new Date();
	const diffDays = Math.floor((today - date) / 86400000);
	if (diffDays === 0) return "Today";
	if (diffDays === 1) return "Yesterday";
	return `${diffDays} days ago`;
};

const siteLabel = (name, userId) => {
	const label = String(name || "").trim();
	if (label) return label;
	const id = String(userId || "unassigned");
	if (id === "unassigned") return "Unknown Site";
	return `Site ${id.slice(-6).toUpperCase()}`;
};

const EmptyAlerts = () => (
	<div className="px-5 py-12 text-center">
		<div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-2xl">
			✅
		</div>
		<p className="mt-3 text-sm font-bold text-slate-700">No alerts right now</p>
		<p className="mt-1 text-xs text-slate-500">All your sites are running smoothly.</p>
	</div>
);

const AlertCard = ({ alert, showDetails }) => {
	const meta = priorityMeta[alert.priority] || priorityMeta.P0;
	const alertType = getFriendlyAlertType(alert.alert_type || alert.title || "");
	const message = getFriendlyMessage(alert.short_message || alert.title || "");
	const description = getFriendlyMessage(alert.description || "");
	const recommendation = getFriendlyRecommendation(
		Array.isArray(alert.maintenance_recommendations) && alert.maintenance_recommendations.length
			? alert.maintenance_recommendations[0]
			: ""
	);
	const site = siteLabel(alert.user_name || alert.site_name, alert.user_id);
	const when = formatDate(alert.triggered_at || alert.created_at);

	return (
		<div className="group border-b border-slate-100 px-4 py-4 transition hover:bg-amber-50/30 sm:px-5">
			<div className="flex items-start gap-3">
				{/* Urgency badge */}
				<div className="flex flex-col items-center gap-1 pt-0.5">
					<span className={`inline-flex min-w-[3.5rem] justify-center rounded-full border px-2.5 py-1 text-xs font-black ${meta.color}`}>
						{meta.label}
					</span>
				</div>

				{/* Content */}
				<div className="min-w-0 flex-1">
					<div className="flex flex-wrap items-center gap-2">
						<p className="text-sm font-bold text-slate-900">{site}</p>
						<span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-bold text-slate-600">
							{alertType}
						</span>
						{when && <span className="ml-auto text-xs text-slate-400">{when}</span>}
					</div>

					<p className="mt-1 text-sm text-slate-700">{message}</p>

					{showDetails && description && description !== message && (
						<p className="mt-1 text-xs text-slate-500">{description}</p>
					)}

					{showDetails && recommendation && (
						<div className="mt-2 flex items-start gap-1.5 rounded-lg border border-emerald-100 bg-emerald-50 px-3 py-2">
							<span className="text-sm">💡</span>
							<p className="text-xs font-semibold text-emerald-800">{recommendation}</p>
						</div>
					)}
				</div>
			</div>
		</div>
	);
};

const SOICActiveAlerts = ({ alerts = [], fullPage = false }) => {
	const sorted = [...alerts]
		.sort((a, b) => (priorityRank[b.priority] ?? -1) - (priorityRank[a.priority] ?? -1));

	const urgent = sorted.filter((a) => ["P4", "P5"].includes(a.priority));
	const other = sorted.filter((a) => !["P4", "P5"].includes(a.priority));
	const visibleAlerts = fullPage ? sorted : sorted.slice(0, 6);

	return (
		<section className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white/90 shadow-sm">
			<div className="flex flex-col gap-2 border-b border-slate-200/70 bg-slate-50/70 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
				<div>
					<p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">What Needs Attention</p>
					<h2 className="mt-1 text-lg font-bold text-slate-900">Active Alerts</h2>
				</div>
				<div className="flex items-center gap-2">
					{urgent.length > 0 && (
						<span className="rounded-full bg-rose-100 px-3 py-1 text-xs font-bold text-rose-700">
							🚨 {urgent.length} urgent
						</span>
					)}
					<span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">
						{alerts.length} total
					</span>
				</div>
			</div>

			{visibleAlerts.length ? (
				<div>
					{/* Urgent alerts highlighted at top */}
					{!fullPage && urgent.length > 0 && (
						<div className="border-b border-rose-100 bg-rose-50/40 px-4 py-2 sm:px-5">
							<p className="text-xs font-bold text-rose-600">🚨 Requires urgent action</p>
						</div>
					)}

					{visibleAlerts.map((alert) => (
						<AlertCard
							key={alert._id || `${alert.user_id}-${alert.priority}-${alert.alert_type}`}
							alert={alert}
							showDetails={fullPage}
						/>
					))}

					{!fullPage && alerts.length > 6 && (
						<div className="border-t border-slate-100 bg-slate-50/60 px-5 py-3 text-center">
							<p className="text-xs font-semibold text-slate-500">
								+{alerts.length - 6} more alerts — go to the Alerts tab to see all
							</p>
						</div>
					)}
				</div>
			) : (
				<EmptyAlerts />
			)}
		</section>
	);
};

export default SOICActiveAlerts;
