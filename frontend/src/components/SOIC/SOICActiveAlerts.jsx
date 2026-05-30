import { getSimpleAlertText, getSimpleAlertType } from "./alertCopy";

const colorByPriority = {
	P0: "border-blue-200 bg-blue-50 text-blue-700",
	P1: "border-lime-200 bg-lime-50 text-lime-700",
	P2: "border-amber-200 bg-amber-50 text-amber-700",
	P3: "border-orange-200 bg-orange-50 text-orange-700",
	P4: "border-rose-200 bg-rose-50 text-rose-700",
	P5: "border-red-700 bg-red-700 text-white"
};

const priorityRank = {
	P5: 5,
	P4: 4,
	P3: 3,
	P2: 2,
	P1: 1,
	P0: 0
};

const formatDate = (value) => {
	if (!value) return "Not dated";

	const date = new Date(value);
	if (Number.isNaN(date.getTime())) return "Not dated";

	return date.toLocaleDateString([], { month: "short", day: "numeric" });
};

const formatPercent = (value) => {
	const parsed = Number(value);
	if (!Number.isFinite(parsed) || parsed <= 0) return "0%";
	return `${Math.round(parsed * 100)}%`;
};

const siteLabel = (name, value) => {
	const label = String(name || "").trim();
	if (label) return label;

	const id = String(value || "unassigned");
	if (id === "unassigned") return "Unassigned";
	return `Site ${id.slice(-6).toUpperCase()}`;
};

const EmptyAlerts = () => (
	<div className="px-5 py-10 text-center">
		<div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-sm font-black text-emerald-700">
			OK
		</div>
		<p className="mt-3 text-sm font-bold text-slate-700">No active alerts</p>
		<p className="mt-1 text-xs text-slate-500">The current SOIC queue is clear.</p>
	</div>
);

const SOICActiveAlerts = ({ alerts = [], fullPage = false }) => {
	const visibleAlerts = [...alerts]
		.sort((left, right) => (priorityRank[right.priority] ?? -1) - (priorityRank[left.priority] ?? -1))
		.slice(0, fullPage ? alerts.length : 6);

	return (
		<section className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white/90 shadow-sm">
			<div className="flex flex-col gap-2 border-b border-slate-200/70 bg-slate-50/70 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
				<div>
					<p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Alert Queue</p>
					<h2 className="mt-1 text-lg font-bold text-slate-900">Active Alerts</h2>
				</div>
				<span className="self-start rounded-full bg-rose-100 px-3 py-1 text-xs font-bold text-rose-700 sm:self-auto">
					{alerts.length} open
				</span>
			</div>

			{visibleAlerts.length ? (
				<div className="overflow-x-auto">
					<table className="min-w-[860px] w-full border-collapse text-left text-sm text-slate-700">
						<thead>
							<tr className="bg-white">
								<th className="border-b border-slate-200 px-5 py-3 text-xs font-bold uppercase tracking-wide text-slate-600">Priority</th>
								<th className="border-b border-slate-200 px-5 py-3 text-xs font-bold uppercase tracking-wide text-slate-600">Site</th>
								<th className="border-b border-slate-200 px-5 py-3 text-xs font-bold uppercase tracking-wide text-slate-600">Type</th>
								<th className="border-b border-slate-200 px-5 py-3 text-xs font-bold uppercase tracking-wide text-slate-600">Message</th>
								<th className="border-b border-slate-200 px-5 py-3 text-xs font-bold uppercase tracking-wide text-slate-600">Status</th>
								<th className="border-b border-slate-200 px-5 py-3 text-right text-xs font-bold uppercase tracking-wide text-slate-600">Confidence</th>
								<th className="border-b border-slate-200 px-5 py-3 text-right text-xs font-bold uppercase tracking-wide text-slate-600">Opened</th>
							</tr>
						</thead>
						<tbody>
							{visibleAlerts.map((alert) => (
								<tr key={alert._id || `${alert.user_id}-${alert.priority}-${alert.title}`} className="group hover:bg-amber-50/40">
									<td className="border-b border-slate-100 px-5 py-4">
										<span className={`inline-flex min-w-10 justify-center rounded-full border px-2.5 py-1 text-xs font-black ${colorByPriority[alert.priority] || "border-slate-200 bg-slate-100 text-slate-700"}`}>
											{alert.priority || "P0"}
										</span>
									</td>
									<td className="border-b border-slate-100 px-5 py-4 font-semibold text-slate-800">{siteLabel(alert.user_name || alert.site_name, alert.user_id)}</td>
									<td className="border-b border-slate-100 px-5 py-4">
										<span className="rounded-md bg-slate-100 px-2 py-1 text-xs font-bold uppercase tracking-wide text-slate-600">
											{getSimpleAlertType(String(alert.alert_type || "general").replaceAll("_", " "))}
										</span>
									</td>
									<td className="border-b border-slate-100 px-5 py-4">
										<p className="font-semibold text-slate-800">{getSimpleAlertText(alert.short_message || alert.title || "Alert requires review")}</p>
										{fullPage && alert.description && <p className="mt-1 max-w-xl text-xs text-slate-500">{getSimpleAlertText(alert.description)}</p>}
										{fullPage && Array.isArray(alert.maintenance_recommendations) && alert.maintenance_recommendations.length > 0 && (
											<p className="mt-1 max-w-xl text-xs font-semibold text-emerald-700">
												{alert.maintenance_recommendations[0]}
											</p>
										)}
									</td>
									<td className="border-b border-slate-100 px-5 py-4">
										<span className="rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-bold text-blue-700">
											{alert.status || "CREATED"}
										</span>
									</td>
									<td className="border-b border-slate-100 px-5 py-4 text-right font-bold text-slate-700">{formatPercent(alert.confidence_score)}</td>
									<td className="border-b border-slate-100 px-5 py-4 text-right text-slate-500">{formatDate(alert.triggered_at || alert.created_at)}</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
			) : (
				<EmptyAlerts />
			)}
		</section>
	);
};

export default SOICActiveAlerts;
