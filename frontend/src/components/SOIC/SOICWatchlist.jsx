const safeNumber = (value) => {
	const parsed = Number(value);
	return Number.isFinite(parsed) ? parsed : 0;
};

const formatRatio = (value) => {
	const ratio = safeNumber(value);
	return ratio ? `${(ratio * 100).toFixed(1)}%` : "0.0%";
};

const formatDelta = (value) => {
	const parsed = safeNumber(value);
	if (!parsed) return "0.0%";
	const sign = parsed > 0 ? "+" : "";
	return `${sign}${parsed.toFixed(1)}%`;
};

const formatDate = (value) => {
	if (!value) return "No date";
	const date = new Date(value);
	if (Number.isNaN(date.getTime())) return "No date";
	return date.toLocaleDateString([], { month: "short", day: "numeric" });
};

const siteLabel = (value) => {
	const id = String(value || "unknown");
	if (id === "unknown") return "Site Unknown";
	return `Site ${id.slice(-6).toUpperCase()}`;
};

const SOICWatchlist = ({ items = [], fullPage = false }) => {
	const visibleItems = items.slice(0, fullPage ? items.length : 6);

	return (
		<section className="overflow-hidden rounded-2xl border border-amber-200/80 bg-white/90 shadow-sm">
			<div className="flex flex-col gap-2 border-b border-amber-100 bg-gradient-to-r from-amber-50 to-yellow-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
				<div>
					<p className="text-xs font-bold uppercase tracking-[0.14em] text-amber-700">Monitoring Band</p>
					<h2 className="mt-1 text-lg font-bold text-slate-900">Watchlist</h2>
				</div>
				<span className="self-start rounded-full bg-white px-3 py-1 text-xs font-bold text-amber-700 shadow-sm sm:self-auto">
					{items.length} sites
				</span>
			</div>

			<div className="p-4 sm:p-5">
				{visibleItems.length ? (
					<div className={fullPage ? "grid gap-3 md:grid-cols-2" : "space-y-3"}>
						{visibleItems.map((item, index) => {
							const ratio = safeNumber(item.performance_ratio);
							const barWidth = Math.max(8, Math.min(100, ratio * 100));
							const alertTypes = Array.isArray(item.alert_types_triggered) ? item.alert_types_triggered : [];

							return (
								<div key={item._id || `${item.user_id}-${item.date}-${index}`} className="rounded-xl border border-amber-100 bg-amber-50/45 p-3 transition hover:border-amber-200 hover:bg-amber-50">
									<div className="flex items-start justify-between gap-3">
										<div className="min-w-0">
											<p className="truncate text-sm font-bold text-slate-900">{siteLabel(item.user_id)}</p>
											<p className="mt-1 text-xs font-semibold text-slate-500">{formatDate(item.date)}</p>
										</div>
										<div className="text-right">
											<p className="text-lg font-bold text-amber-700">{formatRatio(ratio)}</p>
											<p className="text-xs font-semibold text-slate-500">PR</p>
										</div>
									</div>

									<div className="mt-3 h-2 overflow-hidden rounded-full bg-white">
										<div className="h-full rounded-full bg-gradient-to-r from-amber-500 to-yellow-400" style={{ width: `${barWidth}%` }} />
									</div>

									<div className="mt-3 grid grid-cols-2 gap-2 text-xs">
										<div>
											<p className="font-semibold uppercase tracking-wide text-slate-500">Delta</p>
											<p className={`font-bold ${safeNumber(item.difference_percent) < 0 ? "text-rose-700" : "text-emerald-700"}`}>
												{formatDelta(item.difference_percent)}
											</p>
										</div>
										<div>
											<p className="font-semibold uppercase tracking-wide text-slate-500">Drift</p>
											<p className={`font-bold ${safeNumber(item.baseline_drift_percent) < 0 ? "text-rose-700" : "text-slate-700"}`}>
												{formatDelta(item.baseline_drift_percent)}
											</p>
										</div>
									</div>

									{fullPage && alertTypes.length > 0 && (
										<div className="mt-3 flex flex-wrap gap-1.5">
											{alertTypes.map((type) => (
												<span key={type} className="rounded-full bg-white px-2 py-1 text-[11px] font-bold uppercase tracking-wide text-amber-700">
													{String(type).replaceAll("_", " ")}
												</span>
											))}
										</div>
									)}
								</div>
							);
						})}
					</div>
				) : (
					<div className="py-8 text-center">
						<div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-xs font-black text-slate-500">
							PR
						</div>
						<p className="mt-3 text-sm font-bold text-slate-700">No watchlist items</p>
						<p className="mt-1 text-xs text-slate-500">Sites between warning and healthy thresholds will appear here.</p>
					</div>
				)}
			</div>
		</section>
	);
};

export default SOICWatchlist;
