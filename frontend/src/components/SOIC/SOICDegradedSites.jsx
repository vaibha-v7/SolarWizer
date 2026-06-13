const safeNumber = (value) => {
	const parsed = Number(value);
	return Number.isFinite(parsed) ? parsed : 0;
};

const formatRatio = (value) => {
	const ratio = safeNumber(value);
	return ratio ? `${(ratio * 100).toFixed(1)}%` : "0.0%";
};

const siteLabel = (name, userId) => {
	const label = String(name || "").trim();
	if (label) return label;
	const id = String(userId || "unknown");
	if (id === "unknown") return "Unknown Site";
	return `Site ${id.slice(-6).toUpperCase()}`;
};

const getGapLabel = (ratio) => {
	const gap = 100 - ratio * 100;
	if (gap <= 5) return { label: "Slightly below average", color: "text-amber-600" };
	if (gap <= 15) return { label: "Noticeably underproducing", color: "text-orange-600" };
	if (gap <= 25) return { label: "Significantly underproducing", color: "text-rose-600" };
	return { label: "Critically underproducing", color: "text-red-700" };
};

const SOICDegradedSites = ({ metrics = {}, onSiteClick }) => {
	const list = Array.isArray(metrics.top_5_worst_performers) ? metrics.top_5_worst_performers : [];

	return (
		<section className="overflow-hidden rounded-2xl border border-orange-200/80 bg-white/90 shadow-sm">
			<div className="border-b border-orange-100 bg-gradient-to-r from-orange-50 to-amber-50 px-4 py-3 sm:px-5">
				<p className="text-xs font-bold uppercase tracking-[0.14em] text-orange-700">📉 Needs Attention</p>
				<h2 className="mt-1 text-lg font-bold text-slate-900">Underperforming Sites</h2>
				<p className="mt-0.5 text-xs text-slate-500">Sites producing less than expected from their live inverter data</p>
			</div>

			<div className="p-4 sm:p-5">
				{list.length > 0 ? (
					<div className="space-y-5">
						<div className="rounded-2xl border-2 border-orange-400 bg-orange-50 p-4 shadow-sm relative overflow-hidden">
							<div className="absolute -top-4 -right-4 p-4 text-orange-500/20 text-8xl pointer-events-none">⚠</div>
							<div className="relative z-10">
								<p className="text-xs font-bold uppercase tracking-[0.14em] text-orange-800">⚠ Most Critical Site</p>
								<div className="mt-2 flex justify-between items-end">
									<div>
										<button 
											onClick={() => onSiteClick && onSiteClick(list[0].user_id)}
											className="text-xl font-bold text-slate-900 hover:text-orange-700 hover:underline text-left transition"
										>
											{siteLabel(list[0].user_name || list[0].name, list[0].user_id)}
										</button>
										{list[0].predicted_generation_kwh > 0 && list[0].actual_generation_kwh !== undefined && (
											<p className="text-sm font-semibold text-orange-700 mt-1">
												{Number(list[0].actual_generation_kwh).toFixed(1)} kW / {Number(list[0].predicted_generation_kwh).toFixed(1)} kW
											</p>
										)}
									</div>
									<div className="text-right">
										<p className="text-3xl font-black text-orange-600">{formatRatio(list[0].performance_ratio)}</p>
									</div>
								</div>
							</div>
						</div>
						<div className="space-y-3">
							{list.map((site, index) => {
							const ratio = safeNumber(site.performance_ratio);
							const barWidth = Math.max(8, Math.min(100, ratio * 100));
							const gapInfo = getGapLabel(ratio);

							return (
								<div key={`${site.user_id || "site"}-${index}`} className="rounded-xl border border-orange-100 bg-orange-50/55 p-3 transition hover:border-orange-200 hover:bg-orange-50">
									<div className="flex items-center justify-between gap-3">
										<div className="flex min-w-0 items-center gap-3">
											<span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-orange-600 text-xs font-black text-white">
												{index + 1}
											</span>
											<div className="min-w-0">
												<button 
													onClick={() => onSiteClick && onSiteClick(site.user_id)}
													className="block truncate text-sm font-bold text-slate-900 hover:text-orange-700 hover:underline transition text-left"
												>
													{siteLabel(site.user_name || site.name, site.user_id)}
												</button>
												<p className={`text-xs font-semibold ${gapInfo.color}`}>{gapInfo.label}</p>
											</div>
										</div>
										<div className="shrink-0 text-right">
											<p className="text-lg font-bold text-orange-700">{formatRatio(ratio)}</p>
											<p className="text-xs text-slate-400">of target</p>
										</div>
									</div>
									<div className="mt-3 h-2 overflow-hidden rounded-full bg-white">
										<div className="h-full rounded-full bg-gradient-to-r from-orange-500 to-amber-400" style={{ width: `${barWidth}%` }} />
									</div>
								</div>
							);
						})}
						</div>
					</div>
				) : (
					<div className="py-8 text-center">
						<div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-xl">
							✅
						</div>
						<p className="mt-3 text-sm font-bold text-slate-700">No underperforming sites</p>
						<p className="mt-1 text-xs text-slate-500">Sites with live data are all within expected output range.</p>
					</div>
				)}
			</div>
		</section>
	);
};

export default SOICDegradedSites;
