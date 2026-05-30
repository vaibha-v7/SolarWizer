const safeNumber = (value) => {
	const parsed = Number(value);
	return Number.isFinite(parsed) ? parsed : 0;
};

const formatRatio = (value) => {
	const ratio = safeNumber(value);
	return ratio ? `${(ratio * 100).toFixed(1)}%` : "0.0%";
};

const siteLabel = (value) => {
	const id = String(value || "unknown");
	if (id === "unknown") return "Site Unknown";
	return `Site ${id.slice(-6).toUpperCase()}`;
};

const SOICDegradedSites = ({ metrics = {} }) => {
	const list = Array.isArray(metrics.top_5_worst_performers) ? metrics.top_5_worst_performers : [];

	return (
		<section className="overflow-hidden rounded-2xl border border-orange-200/80 bg-white/90 shadow-sm">
			<div className="border-b border-orange-100 bg-gradient-to-r from-orange-50 to-amber-50 px-4 py-3 sm:px-5">
				<p className="text-xs font-bold uppercase tracking-[0.14em] text-orange-700">Degradation Watch</p>
				<h2 className="mt-1 text-lg font-bold text-slate-900">Most Degraded Sites</h2>
			</div>

			<div className="p-4 sm:p-5">
				{list.length ? (
					<div className="space-y-3">
						{list.map((site, index) => {
							const ratio = safeNumber(site.performance_ratio);
							const barWidth = Math.max(8, Math.min(100, ratio * 100));

							return (
								<div key={`${site.user_id || "site"}-${index}`} className="rounded-xl border border-orange-100 bg-orange-50/55 p-3 transition hover:border-orange-200 hover:bg-orange-50">
									<div className="flex items-center justify-between gap-3">
										<div className="flex min-w-0 items-center gap-3">
											<span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-orange-600 text-xs font-black text-white">
												{index + 1}
											</span>
											<div className="min-w-0">
												<p className="truncate text-sm font-bold text-slate-900">{site.user_name || siteLabel(site.user_id)}</p>
												<p className="text-xs font-semibold text-orange-700">Underperforming ratio</p>
											</div>
										</div>
										<p className="text-lg font-bold text-orange-700">{formatRatio(ratio)}</p>
									</div>
									<div className="mt-3 h-2 overflow-hidden rounded-full bg-white">
										<div className="h-full rounded-full bg-gradient-to-r from-orange-500 to-amber-400" style={{ width: `${barWidth}%` }} />
									</div>
								</div>
							);
						})}
					</div>
				) : (
					<div className="py-8 text-center">
						<div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-xs font-black text-emerald-700">
							OK
						</div>
						<p className="mt-3 text-sm font-bold text-slate-700">No degraded sites currently</p>
						<p className="mt-1 text-xs text-slate-500">Underperformers will appear when the daily baseline detects drift.</p>
					</div>
				)}
			</div>
		</section>
	);
};

export default SOICDegradedSites;
