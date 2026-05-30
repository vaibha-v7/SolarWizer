import { getSimpleAlertText } from "./alertCopy";

const siteLabel = (name, value) => {
	const label = String(name || "").trim();
	if (label) return label;

	const id = String(value || "unassigned");
	if (id === "unassigned") return "Unassigned";
	return `Site ${id.slice(-6).toUpperCase()}`;
};

const formatHealth = (value) => {
	const parsed = Number(value);
	if (!Number.isFinite(parsed)) return "0";
	return parsed.toFixed(0);
};

const priorityClass = {
	P4: "border-rose-200 bg-rose-50 text-rose-800",
	P5: "border-red-300 bg-red-600 text-white"
};

const SOICCriticalSites = ({ alerts = [], healthScores = [], fullPage = false }) => {
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
						<p className="text-xs font-bold uppercase tracking-[0.14em] text-rose-600">High Urgency</p>
						<h2 className="mt-1 text-lg font-bold text-slate-900">Critical Sites</h2>
					</div>
					<span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-rose-700 shadow-sm">
						{criticalAlerts.length} alerts
					</span>
				</div>
			</div>

			<div className="p-4 sm:p-5">
				{criticalAlerts.length ? (
					<div className="space-y-3">
						{criticalAlerts.map((alert) => (
							<div key={alert._id || `${alert.user_id}-${alert.title}`} className="rounded-xl border border-rose-100 bg-rose-50/70 p-3">
								<div className="flex items-start justify-between gap-3">
									<div>
										<p className="text-sm font-bold text-slate-900">{siteLabel(alert.user_name || alert.site_name, alert.user_id)}</p>
										<p className="mt-1 text-xs font-semibold text-slate-600">{getSimpleAlertText(alert.short_message || alert.title || "Critical alert")}</p>
									</div>
									<span className={`rounded-full border px-2.5 py-1 text-xs font-black ${priorityClass[alert.priority] || "border-rose-200 bg-rose-50 text-rose-800"}`}>
										{alert.priority}
									</span>
								</div>
								<div className="mt-3 grid grid-cols-2 gap-2 text-xs">
									<div>
										<p className="font-semibold uppercase tracking-wide text-slate-500">Actual</p>
										<p className="font-bold text-slate-800">{Number(alert.actual_performance || 0).toFixed(2)}</p>
									</div>
									<div>
										<p className="font-semibold uppercase tracking-wide text-slate-500">Baseline</p>
										<p className="font-bold text-slate-800">{Number(alert.baseline_performance || 0).toFixed(2)}</p>
									</div>
								</div>
							</div>
						))}
					</div>
				) : criticalScores.length ? (
					<div className="space-y-3">
						{criticalScores.map((score) => (
							<div key={score._id || String(score.user_id)} className="rounded-xl border border-amber-100 bg-amber-50/70 p-3">
								<div className="flex items-center justify-between gap-3">
									<div>
										<p className="text-sm font-bold text-slate-900">{siteLabel(score.user_name || score.site_name, score.user_id)}</p>
										<p className="mt-1 text-xs font-semibold text-slate-600">{score.health_category || "CRITICAL"}</p>
									</div>
									<span className="rounded-full bg-white px-2.5 py-1 text-xs font-black text-amber-700 shadow-sm">
										{formatHealth(score.health_score)}
									</span>
								</div>
							</div>
						))}
					</div>
				) : (
					<div className="py-8 text-center">
						<div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-sm font-black text-emerald-700">
							OK
						</div>
						<p className="mt-3 text-sm font-bold text-slate-700">No critical sites currently</p>
						<p className="mt-1 text-xs text-slate-500">Critical and emergency queues are clear.</p>
					</div>
				)}
			</div>
		</section>
	);
};

export default SOICCriticalSites;
