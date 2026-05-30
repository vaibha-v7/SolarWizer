const safeNumber = (value, fallback = 0) => {
	const parsed = Number(value);
	return Number.isFinite(parsed) ? parsed : fallback;
};

const clampPercent = (value) => Math.max(0, Math.min(100, value));

const formatRatio = (value) => {
	const ratio = safeNumber(value);
	if (!ratio) return "0.0%";
	return `${(ratio * 100).toFixed(1)}%`;
};

const averageHealthScore = (metrics, healthScores) => {
	if (safeNumber(metrics?.average_fleet_health)) return safeNumber(metrics.average_fleet_health);
	if (!healthScores?.length) return 0;

	const total = healthScores.reduce((sum, item) => sum + safeNumber(item.health_score), 0);
	return total / healthScores.length;
};

const SOICFleetOverview = ({ metrics = {}, healthScores = [], activeAlerts = [], watchlist = [] }) => {
	const totalSites = safeNumber(metrics.total_sites);
	const healthySites = safeNumber(metrics.healthy_sites);
	const warningSites = safeNumber(metrics.warning_sites);
	const criticalSites = safeNumber(metrics.critical_sites);
	const offlineSites = safeNumber(metrics.offline_sites);
	const avgHealth = averageHealthScore(metrics, healthScores);
	const avgPerformance = safeNumber(metrics.fleet_avg_performance_ratio);
	const medianPerformance = safeNumber(metrics.fleet_median_performance_ratio);

	const cards = [
		{
			label: "Total Sites",
			value: totalSites,
			helper: `${offlineSites} offline`,
			bar: totalSites ? 100 : 0,
			accent: "from-slate-700 to-slate-500",
			text: "text-slate-900",
			bg: "bg-slate-100"
		},
		{
			label: "Healthy Sites",
			value: healthySites,
			helper: `${totalSites ? Math.round((healthySites / totalSites) * 100) : 0}% of fleet`,
			bar: totalSites ? (healthySites / totalSites) * 100 : 0,
			accent: "from-emerald-600 to-teal-500",
			text: "text-emerald-700",
			bg: "bg-emerald-100"
		},
		{
			label: "Warning Sites",
			value: warningSites,
			helper: "Needs review",
			bar: totalSites ? (warningSites / totalSites) * 100 : 0,
			accent: "from-amber-500 to-orange-500",
			text: "text-amber-700",
			bg: "bg-amber-100"
		},
		{
			label: "Critical Sites",
			value: criticalSites,
			helper: "Priority queue",
			bar: totalSites ? (criticalSites / totalSites) * 100 : 0,
			accent: "from-rose-600 to-red-500",
			text: "text-rose-700",
			bg: "bg-rose-100"
		},
		{
			label: "Open Alerts",
			value: activeAlerts.length,
			helper: "Active or escalated",
			bar: totalSites ? (activeAlerts.length / Math.max(totalSites, 1)) * 100 : 0,
			accent: "from-blue-600 to-cyan-500",
			text: "text-blue-700",
			bg: "bg-blue-100"
		},
		{
			label: "Avg Health",
			value: avgHealth ? avgHealth.toFixed(1) : "0.0",
			helper: "Composite score",
			bar: avgHealth,
			accent: "from-violet-600 to-fuchsia-500",
			text: "text-violet-700",
			bg: "bg-violet-100"
		}
	];

	return (
		<section className="space-y-4">
			<div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-6">
				{cards.map((card) => (
					<div key={card.label} className="rounded-2xl border border-slate-200/80 bg-white/90 p-4 shadow-sm">
						<div className="flex items-start justify-between gap-3">
							<div>
								<p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{card.label}</p>
								<p className={`mt-2 text-3xl font-bold ${card.text}`}>{card.value}</p>
							</div>
							<div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${card.bg} text-xs font-black ${card.text}`}>
								{String(card.label).slice(0, 2).toUpperCase()}
							</div>
						</div>
						<div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-100">
							<div
								className={`h-full rounded-full bg-gradient-to-r ${card.accent}`}
								style={{ width: `${clampPercent(card.bar)}%` }}
							/>
						</div>
						<p className="mt-2 text-xs font-semibold text-slate-500">{card.helper}</p>
					</div>
				))}
			</div>

			<div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
				<div className="rounded-2xl border border-slate-200/80 bg-white/90 p-5 shadow-sm lg:col-span-2">
					<div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
						<div>
							<p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Fleet Performance</p>
							<h2 className="mt-1 text-xl font-bold text-slate-900">Generation Reliability</h2>
						</div>
						<span className="self-start rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-800 sm:self-auto">
							{watchlist.length} watched
						</span>
					</div>

					<div className="mt-5 grid gap-4 sm:grid-cols-3">
						<div className="rounded-xl bg-slate-50 p-4">
							<p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Average PR</p>
							<p className="mt-2 text-2xl font-bold text-slate-900">{formatRatio(avgPerformance)}</p>
						</div>
						<div className="rounded-xl bg-slate-50 p-4">
							<p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Median PR</p>
							<p className="mt-2 text-2xl font-bold text-slate-900">{formatRatio(medianPerformance)}</p>
						</div>
						<div className="rounded-xl bg-slate-50 p-4">
							<p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Std Dev</p>
							<p className="mt-2 text-2xl font-bold text-slate-900">{safeNumber(metrics.fleet_std_dev).toFixed(3)}</p>
						</div>
					</div>

					<div className="mt-5 space-y-3">
						{[
							{ label: "P90", value: metrics.p90_performance, color: "bg-emerald-500" },
							{ label: "P75", value: metrics.p75_performance, color: "bg-teal-500" },
							{ label: "P50", value: metrics.p50_performance, color: "bg-blue-500" },
							{ label: "P25", value: metrics.p25_performance, color: "bg-amber-500" },
							{ label: "P10", value: metrics.p10_performance, color: "bg-rose-500" }
						].map((item) => {
							const percentage = clampPercent(safeNumber(item.value) * 100);
							return (
								<div key={item.label} className="grid grid-cols-[3rem_1fr_4.5rem] items-center gap-3">
									<span className="text-xs font-bold text-slate-500">{item.label}</span>
									<div className="h-2 overflow-hidden rounded-full bg-slate-100">
										<div className={`h-full rounded-full ${item.color}`} style={{ width: `${percentage}%` }} />
									</div>
									<span className="text-right text-xs font-bold text-slate-700">{formatRatio(item.value)}</span>
								</div>
							);
						})}
					</div>
				</div>

				<div className="rounded-2xl border border-slate-200/80 bg-[linear-gradient(135deg,#0f172a_0%,#1e293b_55%,#14532d_100%)] p-5 text-white shadow-sm">
					<p className="text-xs font-bold uppercase tracking-[0.14em] text-emerald-200">Operations Readout</p>
					<h2 className="mt-2 text-2xl font-bold">{criticalSites ? "Action Required" : "Fleet Stable"}</h2>
					<p className="mt-2 text-sm text-slate-200">
						{criticalSites
							? `${criticalSites} sites are currently classified as critical.`
							: "No critical sites are present in the latest fleet snapshot."}
					</p>
					<div className="mt-6 grid grid-cols-2 gap-3">
						<div className="rounded-xl bg-white/10 p-3">
							<p className="text-xs font-semibold uppercase tracking-wide text-slate-300">Health Score</p>
							<p className="mt-2 text-2xl font-bold">{avgHealth ? avgHealth.toFixed(0) : 0}</p>
						</div>
						<div className="rounded-xl bg-white/10 p-3">
							<p className="text-xs font-semibold uppercase tracking-wide text-slate-300">Alert Load</p>
							<p className="mt-2 text-2xl font-bold">{activeAlerts.length}</p>
						</div>
					</div>
				</div>
			</div>
		</section>
	);
};

export default SOICFleetOverview;
