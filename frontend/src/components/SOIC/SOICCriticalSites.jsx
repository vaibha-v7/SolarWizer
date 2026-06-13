import { getFriendlyMessage, getHealthLabel, priorityMeta } from "./alertCopy";

const siteLabel = (name, userId) => {
	const label = String(name || "").trim();
	if (label) return label;
	const id = String(userId || "unknown");
	if (id === "unknown") return "Unknown Site";
	return `Deleted Site (${id.slice(-6).toUpperCase()})`;
};

const SOICCriticalSites = ({ alerts = [], healthScores = [], fullPage = false, onSiteClick }) => {
	const criticalAlerts = alerts
		.filter((item) => ["P4", "P5"].includes(item.priority))
		.slice(0, fullPage ? alerts.length : 5);

	const criticalScores = healthScores
		.filter((score) => String(score.health_category || "").toUpperCase() === "CRITICAL" || Number(score.health_score) < 45)
		.slice(0, fullPage ? healthScores.length : 5);

	return (
		<section className="overflow-hidden rounded-2xl border border-rose-200/80 bg-white/90 shadow-sm">
			<div className="border-b border-rose-100 bg-gradient-to-r from-rose-50 to-orange-50 px-4 py-3 sm:px-5">
				<div className="flex items-start justify-between gap-3">
					<div>
						<p className="text-xs font-bold uppercase tracking-[0.14em] text-rose-600">🚨 Needs Immediate Action</p>
						<h2 className="mt-1 text-lg font-bold text-slate-900">Sites in Critical State</h2>
					</div>
					<span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-rose-700 shadow-sm">
						{criticalAlerts.length} {criticalAlerts.length === 1 ? "site" : "sites"}
					</span>
				</div>
			</div>

			<div className="p-4 sm:p-5">
				{criticalAlerts.length ? (
					<div className="space-y-3">
						{criticalAlerts.map((alert) => {
							const meta = priorityMeta[alert.priority] || priorityMeta.P4;
							const message = getFriendlyMessage(alert.short_message || alert.title || "");
							const actualPct = Number(alert.actual_performance || 0);
							const baselinePct = Number(alert.baseline_performance || 0);
							const gap = baselinePct > 0 ? Math.round(((baselinePct - actualPct) / baselinePct) * 100) : null;

							return (
								<div key={alert._id || `${alert.user_id}-${alert.title}`} className="rounded-xl border border-rose-100 bg-rose-50/70 p-3">
									<div className="flex items-start justify-between gap-3">
										<div className="min-w-0">
											<div className="flex items-center gap-2">
												<button 
													onClick={() => onSiteClick && onSiteClick(alert.user_id)}
													className="truncate text-sm font-bold text-slate-900 hover:text-rose-700 hover:underline transition text-left"
												>
													{siteLabel(alert.user_name || alert.site_name, alert.user_id)}
												</button>
												<span className={`rounded-full border px-2 py-0.5 text-xs font-black ${meta.color}`}>
													{meta.label}
												</span>
											</div>
											<p className="mt-1 text-xs text-slate-600">{message}</p>
										</div>
									</div>
									{gap !== null && gap > 0 && (
										<div className="mt-2 rounded-lg bg-white/60 px-3 py-1.5 text-xs">
											<span className="font-semibold text-rose-700">
												Producing {gap}% below expected
											</span>
											{" — "}
											<span className="text-slate-500">
												Expected {(baselinePct * 100).toFixed(0)}%, getting {(actualPct * 100).toFixed(0)}%
												{alert.predicted_generation_kwh > 0 && alert.actual_generation_kwh !== undefined && (
													<span className="ml-1 font-medium">({Number(alert.actual_generation_kwh).toFixed(1)} kW / {Number(alert.predicted_generation_kwh).toFixed(1)} kW)</span>
												)}
											</span>
										</div>
									)}
								</div>
							);
						})}
					</div>
				) : criticalScores.length ? (
					<div className="space-y-3">
						{criticalScores.map((score) => {
							const healthMeta = getHealthLabel(score.health_score);
							return (
								<div key={score._id || String(score.user_id)} className="rounded-xl border border-amber-100 bg-amber-50/70 p-3">
									<div className="flex items-center justify-between gap-3">
										<div>
											<p className="text-sm font-bold text-slate-900">{siteLabel(score.user_name || score.site_name, score.user_id)}</p>
											<p className={`mt-1 text-xs font-semibold ${healthMeta.color}`}>Health: {healthMeta.label}</p>
										</div>
										<div className="text-right">
											<p className="text-lg font-bold text-slate-800">{Number(score.health_score || 0).toFixed(0)}</p>
											<p className="text-xs text-slate-500">out of 100</p>
										</div>
									</div>
								</div>
							);
						})}
					</div>
				) : (
					<div className="py-8 text-center">
						<div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-2xl">
							✅
						</div>
						<p className="mt-3 text-sm font-bold text-slate-700">No critical sites right now</p>
						<p className="mt-1 text-xs text-slate-500">All sites are running within acceptable range.</p>
					</div>
				)}
			</div>
		</section>
	);
};

export default SOICCriticalSites;
