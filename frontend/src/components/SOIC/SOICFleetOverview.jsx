import { getHealthLabel, getFriendlyAlertType } from "./alertCopy";

const siteLabel = (name, userId) => {
	const label = String(name || "").trim();
	if (label) return label;
	const id = String(userId || "unknown");
	if (id === "unknown") return "Unknown Site";
	return `Deleted Site (${id.slice(-6).toUpperCase()})`;
};

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

// Friendly description for the fleet reliability section
const getReliabilityInsight = (avgPR, realTimeSiteCount) => {
	if (realTimeSiteCount === 0) return "No live-connected sites yet. Connect your first inverter to see real output data.";
	const pct = (avgPR * 100).toFixed(0);
	if (avgPR >= 0.9) return `Your connected sites are producing at ${pct}% of their expected output — excellent.`;
	if (avgPR >= 0.8) return `Your connected sites are generating ${pct}% of expected output — performing well.`;
	if (avgPR >= 0.7) return `Connected sites are at ${pct}% of expected output — some room for improvement.`;
	return `Connected sites are at ${pct}% of expected output — investigate low-performing sites.`;
};

const SOICFleetOverview = ({ metrics = {}, healthScores = [], activeAlerts = [] }) => {
	const totalSites = safeNumber(metrics.total_sites);
	const healthySites = safeNumber(metrics.healthy_sites);
	const warningSites = safeNumber(metrics.warning_sites);
	const criticalSites = safeNumber(metrics.critical_sites);
	const offlineSites = safeNumber(metrics.offline_sites);
	const avgHealth = averageHealthScore(metrics, healthScores);
	const avgPerformance = safeNumber(metrics.fleet_avg_performance_ratio);
	const medianPerformance = safeNumber(metrics.fleet_median_performance_ratio);
	const healthMeta = getHealthLabel(avgHealth);

	// Count how many sites actually have real-time data (based on best performers list length)
	const realTimeSiteCount = Array.isArray(metrics.top_5_best_performers)
		? metrics.top_5_best_performers.length
		: 0;

	const healthySitesList = Array.isArray(metrics.top_5_best_performers) ? metrics.top_5_best_performers : [];
	const needsAttentionList = Array.isArray(metrics.top_5_worst_performers) ? metrics.top_5_worst_performers : [];
	
	const groupedAlerts = activeAlerts.reduce((acc, alert) => {
		const key = alert.user_id || "unassigned";
		if (!acc[key]) acc[key] = { userId: key, userName: alert.user_name, siteName: alert.site_name, alerts: [] };
		acc[key].alerts.push(alert);
		return acc;
	}, {});
	
	const connectivityIssuesList = Object.values(groupedAlerts).filter(group => 
		group.alerts.some(a => a.alert_type?.includes("NO_REALTIME_DATA") || a.title?.includes("No real-time data"))
	);

	const todaysPriorities = Object.values(groupedAlerts).slice(0, 3);

	const cards = [
		{
			label: "Total Sites",
			value: totalSites,
			helper: offlineSites ? `${offlineSites} offline` : "All online",
			bar: totalSites ? 100 : 0,
			accent: "from-slate-700 to-slate-500",
			text: "text-slate-900",
			bg: "bg-slate-100",
			icon: "🏠"
		},
		{
			label: "Running Well",
			value: healthySites,
			helper: totalSites ? `${Math.round((healthySites / totalSites) * 100)}% of your sites` : "No sites yet",
			bar: totalSites ? (healthySites / totalSites) * 100 : 0,
			accent: "from-emerald-600 to-teal-500",
			text: "text-emerald-700",
			bg: "bg-emerald-100",
			icon: "✅"
		},
		{
			label: "Needs Attention",
			value: warningSites,
			helper: warningSites ? "Review recommended" : "Nothing to review",
			bar: totalSites ? (warningSites / totalSites) * 100 : 0,
			accent: "from-amber-500 to-orange-500",
			text: "text-amber-700",
			bg: "bg-amber-100",
			icon: "⚠️"
		},
		{
			label: "Action Required",
			value: criticalSites,
			helper: criticalSites ? "Urgent — check today" : "No urgent issues",
			bar: totalSites ? (criticalSites / totalSites) * 100 : 0,
			accent: "from-rose-600 to-red-500",
			text: "text-rose-700",
			bg: "bg-rose-100",
			icon: "🚨"
		},
		{
			label: "Open Alerts",
			value: activeAlerts.length,
			helper: activeAlerts.length ? "Unresolved issues" : "All clear",
			bar: Math.min(100, (activeAlerts.length / Math.max(totalSites * 2, 1)) * 100),
			accent: "from-blue-600 to-cyan-500",
			text: "text-blue-700",
			bg: "bg-blue-100",
			icon: "🔔"
		},
		{
			label: "Fleet Health",
			value: avgHealth ? `${avgHealth.toFixed(0)}/100` : "—",
			helper: avgHealth ? healthMeta.label : "Not enough data",
			bar: avgHealth,
			accent: avgHealth >= 80 ? "from-emerald-500 to-teal-400" : avgHealth >= 60 ? "from-amber-500 to-orange-400" : "from-rose-500 to-red-400",
			text: avgHealth >= 80 ? "text-emerald-700" : avgHealth >= 60 ? "text-amber-700" : "text-rose-700",
			bg: avgHealth >= 80 ? "bg-emerald-100" : avgHealth >= 60 ? "bg-amber-100" : "bg-rose-100",
			icon: avgHealth >= 80 ? "💚" : avgHealth >= 60 ? "🟡" : "🔴"
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
							<div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${card.bg} text-base`}>
								{card.icon}
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

			{/* Fleet Status Board */}
			<div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
				<div className="rounded-2xl border border-emerald-200/80 bg-emerald-50/40 p-4 shadow-sm">
					<p className="text-xs font-bold text-emerald-800">🟢 HEALTHY SITES ({healthySitesList.length})</p>
					<div className="mt-3 space-y-3">
						{healthySitesList.map((site, i) => (
							<div key={site.user_id || i} className="rounded border border-emerald-100 bg-white p-2.5 text-sm">
								<p className="font-bold text-slate-900">{siteLabel(site.user_name || site.name, site.user_id)}</p>
								<div className="mt-1 flex items-center justify-between text-xs">
									<span className="font-medium text-emerald-700">
										{Number(site.actual_generation_kwh || 0).toFixed(1)} kW / {Number(site.predicted_generation_kwh || 0).toFixed(1)} kW
									</span>
									<span className="font-bold text-slate-600">{formatRatio(site.performance_ratio)} of target</span>
								</div>
							</div>
						))}
						{!healthySitesList.length && <p className="text-xs text-slate-500">No healthy sites data.</p>}
					</div>
				</div>

				<div className="rounded-2xl border border-amber-200/80 bg-amber-50/40 p-4 shadow-sm">
					<p className="text-xs font-bold text-amber-800">🟠 NEEDS ATTENTION ({needsAttentionList.length})</p>
					<div className="mt-3 space-y-3">
						{needsAttentionList.map((site, i) => (
							<div key={site.user_id || i} className="rounded border border-amber-100 bg-white p-2.5 text-sm">
								<p className="font-bold text-slate-900">{siteLabel(site.user_name || site.name, site.user_id)}</p>
								<div className="mt-1 flex items-center justify-between text-xs">
									<span className="font-medium text-amber-700">
										{Number(site.actual_generation_kwh || 0).toFixed(1)} kW / {Number(site.predicted_generation_kwh || 0).toFixed(1)} kW
									</span>
									<span className="font-bold text-slate-600">{formatRatio(site.performance_ratio)} of target</span>
								</div>
							</div>
						))}
						{!needsAttentionList.length && <p className="text-xs text-slate-500">No sites need attention.</p>}
					</div>
				</div>

				<div className="rounded-2xl border border-blue-200/80 bg-blue-50/40 p-4 shadow-sm">
					<p className="text-xs font-bold text-blue-800">🔵 CONNECTIVITY ISSUES ({connectivityIssuesList.length})</p>
					<div className="mt-3 space-y-3">
						{connectivityIssuesList.map((group, i) => (
							<div key={group.userId || i} className="rounded border border-blue-100 bg-white p-2.5 text-sm">
								<p className="font-bold text-slate-900">{siteLabel(group.userName || group.siteName, group.userId)}</p>
								<p className="mt-0.5 text-xs font-medium text-blue-700">No live telemetry</p>
							</div>
						))}
						{!connectivityIssuesList.length && <p className="text-xs text-slate-500">No connectivity issues.</p>}
					</div>
				</div>
			</div>

			<div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
				{/* Generation Reliability — plain English section */}
				<div className="rounded-2xl border border-slate-200/80 bg-white/90 p-5 shadow-sm lg:col-span-2">
					<div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
						<div>
							<p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Live Site Performance</p>
							<h2 className="mt-1 text-xl font-bold text-slate-900">How Much Power Are Sites Producing?</h2>
							<p className="mt-1 text-xs text-slate-500">
								{getReliabilityInsight(avgPerformance, realTimeSiteCount)}
							</p>
						</div>
						<span className="self-start rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-800 sm:self-auto">
							{realTimeSiteCount} live {realTimeSiteCount === 1 ? "site" : "sites"}
						</span>
					</div>

					{realTimeSiteCount > 0 ? (
						<>
							<div className="mt-5 grid gap-4 sm:grid-cols-3">
								<div className="rounded-xl bg-slate-50 p-4">
									<p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Average Output</p>
									<p className="mt-2 text-2xl font-bold text-slate-900">{formatRatio(avgPerformance)}</p>
									<p className="mt-1 text-xs text-slate-400">of expected production</p>
								</div>
								<div className="rounded-xl bg-slate-50 p-4">
									<p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Typical Site</p>
									<p className="mt-2 text-2xl font-bold text-slate-900">{formatRatio(medianPerformance)}</p>
									<p className="mt-1 text-xs text-slate-400">middle site's output</p>
								</div>
								<div className="rounded-xl bg-slate-50 p-4">
									<p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Consistency</p>
									<p className="mt-2 text-2xl font-bold text-slate-900">
										{realTimeSiteCount < 2 ? "N/A" : safeNumber(metrics.fleet_std_dev) < 0.05 ? "Very consistent" : safeNumber(metrics.fleet_std_dev) < 0.1 ? "Mostly consistent" : "Variable"}
									</p>
									<p className="mt-1 text-xs text-slate-400">how similar sites are</p>
								</div>
							</div>

							<div className="mt-5 space-y-3">
								{[
									{ label: "Top 10% of sites", value: metrics.p90_performance, color: "bg-emerald-500" },
									{ label: "Top 25% of sites", value: metrics.p75_performance, color: "bg-teal-500" },
									{ label: "Middle (typical)", value: metrics.p50_performance, color: "bg-blue-500" },
									{ label: "Bottom 25%", value: metrics.p25_performance, color: "bg-amber-500" },
									{ label: "Bottom 10%", value: metrics.p10_performance, color: "bg-rose-500" }
								].map((item) => {
									const percentage = clampPercent(safeNumber(item.value) * 100);
									return (
										<div key={item.label} className="grid grid-cols-[10rem_1fr_4.5rem] items-center gap-3">
											<span className="text-xs font-semibold text-slate-500">{item.label}</span>
											<div className="h-2 overflow-hidden rounded-full bg-slate-100">
												<div className={`h-full rounded-full ${item.color}`} style={{ width: `${percentage}%` }} />
											</div>
											<span className="text-right text-xs font-bold text-slate-700">{formatRatio(item.value)}</span>
										</div>
									);
								})}
							</div>
						</>
					) : (
						<div className="mt-6 rounded-xl border border-slate-100 bg-slate-50 p-5 text-center">
							<p className="text-sm font-bold text-slate-700">No live inverter data yet</p>
							<p className="mt-1 text-xs text-slate-500">
								Connect a site with a real inverter map to start seeing live performance data here.
							</p>
						</div>
					)}
				</div>

				{/* Operations Readout — plain English */}
				<div className="rounded-2xl border border-slate-200/80 bg-[linear-gradient(135deg,#0f172a_0%,#1e293b_55%,#14532d_100%)] p-5 text-white shadow-sm">
					<p className="text-xs font-bold uppercase tracking-[0.14em] text-emerald-200">Fleet Summary</p>
					<h2 className="mt-2 text-2xl font-bold">
						{criticalSites ? "Action Needed" : activeAlerts.length ? "Review Alerts" : "Everything OK"}
					</h2>
					<p className="mt-2 text-sm text-slate-200">
						{criticalSites
							? `${criticalSites} ${criticalSites === 1 ? "site needs" : "sites need"} urgent attention today.`
							: activeAlerts.length
								? `${activeAlerts.length} open ${activeAlerts.length === 1 ? "alert" : "alerts"} — no emergency.`
								: "All sites are running normally. No action needed."}
					</p>

					<div className="mt-6 space-y-3">
						<div className="rounded-xl bg-white/10 p-3">
							<p className="text-xs font-semibold uppercase tracking-wide text-slate-300">Overall Fleet Health</p>
							<div className="mt-2 flex items-baseline gap-2">
								<p className="text-2xl font-bold">{avgHealth ? avgHealth.toFixed(0) : "—"}</p>
								<p className="text-sm font-semibold text-slate-300">/ 100</p>
								<p className={`ml-auto text-sm font-bold ${avgHealth >= 80 ? "text-emerald-300" : avgHealth >= 60 ? "text-amber-300" : "text-rose-300"}`}>
									{avgHealth ? getHealthLabel(avgHealth).label : "No data"}
								</p>
							</div>
							<div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/20">
								<div
									className={`h-full rounded-full ${avgHealth >= 80 ? "bg-emerald-400" : avgHealth >= 60 ? "bg-amber-400" : "bg-rose-400"}`}
									style={{ width: `${clampPercent(avgHealth)}%` }}
								/>
							</div>
						</div>

						<div className="grid grid-cols-2 gap-3">
							<div className="rounded-xl bg-white/10 p-3">
								<p className="text-xs font-semibold uppercase tracking-wide text-slate-300">Open Alerts</p>
								<p className="mt-2 text-2xl font-bold">{activeAlerts.length}</p>
								<p className="mt-1 text-xs text-slate-400">{activeAlerts.length === 0 ? "None" : "Need review"}</p>
							</div>
							<div className="rounded-xl bg-white/10 p-3">
								<p className="text-xs font-semibold uppercase tracking-wide text-slate-300">Sites Live</p>
								<p className="mt-2 text-2xl font-bold">{realTimeSiteCount}</p>
								<p className="mt-1 text-xs text-slate-400">of {totalSites} total</p>
							</div>
						</div>
					</div>
				</div>
				
				{/* Today's Priorities */}
				<div className="rounded-2xl border border-rose-200/80 bg-rose-50/30 p-5 shadow-sm">
					<p className="text-xs font-bold uppercase tracking-[0.14em] text-rose-800">Today's Priorities</p>
					<h2 className="mt-1 text-lg font-bold text-slate-900">What to check first</h2>
					<div className="mt-4 space-y-3">
						{todaysPriorities.map((group, idx) => {
							const topAlert = group.alerts[0];
							const isConnectivity = topAlert.alert_type?.includes("NO_REALTIME_DATA") || topAlert.title?.includes("No real-time data");
							return (
								<div key={group.userId} className="rounded-xl border border-rose-100 bg-white p-3 shadow-sm">
									<div className="flex items-center gap-2">
										<span className="text-sm font-black text-rose-700">#{idx + 1}</span>
										<p className="font-bold text-slate-900">{siteLabel(group.userName || group.siteName, group.userId)}</p>
									</div>
									<p className="mt-1 text-xs font-semibold text-slate-600">
										{getFriendlyAlertType(topAlert.alert_type || topAlert.title || "")}
									</p>
									<div className="mt-1 flex items-center justify-between text-xs">
										{isConnectivity ? (
											<span className="font-medium text-slate-500">Awaiting inverter connection</span>
										) : (
											<span className="font-bold text-rose-600">
												{topAlert.actual_generation_kwh !== undefined ? `${Number(topAlert.actual_generation_kwh).toFixed(1)} kW / ${Number(topAlert.predicted_generation_kwh).toFixed(1)} kW` : ''}
											</span>
										)}
										<span className="font-medium text-slate-500">{group.alerts.length} active alert{group.alerts.length !== 1 && 's'}</span>
									</div>
								</div>
							);
						})}
						{!todaysPriorities.length && <p className="text-sm text-slate-500 mt-2">No urgent priorities right now.</p>}
					</div>
				</div>
			</div>
		</section>
	);
};

export default SOICFleetOverview;
