import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import SOICFleetOverview from "../components/SOIC/SOICFleetOverview";
import SOICActiveAlerts from "../components/SOIC/SOICActiveAlerts";
import SOICWatchlist from "../components/SOIC/SOICWatchlist";
import SOICCriticalSites from "../components/SOIC/SOICCriticalSites";
import SOICBestPerformers from "../components/SOIC/SOICBestPerformers";
import SOICDegradedSites from "../components/SOIC/SOICDegradedSites";
import SOICRecoveredSites from "../components/SOIC/SOICRecoveredSites";
import {
	fetchSOICDashboard
} from "../services/soicApi";

const EMPTY_METRICS = {
	total_sites: 0,
	healthy_sites: 0,
	warning_sites: 0,
	critical_sites: 0,
	offline_sites: 0,
	fleet_avg_performance_ratio: 0,
	fleet_median_performance_ratio: 0,
	fleet_std_dev: 0,
	top_5_best_performers: [],
	top_5_worst_performers: []
};

const tabs = [
	{ id: "overview", label: "Overview", shortLabel: "Overview" },
	{ id: "alerts", label: "Active Alerts", shortLabel: "Alerts" },
	{ id: "watchlist", label: "Watchlist", shortLabel: "Watch" },
	{ id: "critical", label: "Critical Sites", shortLabel: "Critical" }
];

const priorityRank = {
	P5: 5,
	P4: 4,
	P3: 3,
	P2: 2,
	P1: 1,
	P0: 0
};

const sortAlertsByUrgency = (alerts) =>
	[...alerts].sort((left, right) => {
		const priorityDelta = (priorityRank[right.priority] ?? -1) - (priorityRank[left.priority] ?? -1);
		if (priorityDelta !== 0) return priorityDelta;

		return new Date(right.triggered_at || right.created_at || 0) - new Date(left.triggered_at || left.created_at || 0);
	});

const SOICDashboard = () => {
	const navigate = useNavigate();
	const [fleetMetrics, setFleetMetrics] = useState(EMPTY_METRICS);
	const [activeAlerts, setActiveAlerts] = useState([]);
	const [allAlerts, setAllAlerts] = useState([]);
	const [healthScores, setHealthScores] = useState([]);
	const [watchlist, setWatchlist] = useState([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState("");
	const [activeTab, setActiveTab] = useState("overview");
	const [lastUpdated, setLastUpdated] = useState(null);

	const fetchOperationsData = useCallback(async ({ forceRefresh = false } = {}) => {
		setLoading(true);
		setError("");

		try {
			const dashboard = await fetchSOICDashboard(forceRefresh);
			setFleetMetrics(dashboard?.metrics || EMPTY_METRICS);
			setActiveAlerts(sortAlertsByUrgency(Array.isArray(dashboard?.activeAlerts) ? dashboard.activeAlerts : []));
			setAllAlerts(sortAlertsByUrgency(Array.isArray(dashboard?.alerts) ? dashboard.alerts : []));
			setHealthScores(Array.isArray(dashboard?.healthScores) ? dashboard.healthScores : []);
			setWatchlist(Array.isArray(dashboard?.watchlist) ? dashboard.watchlist : []);
			setLastUpdated(new Date());
		} catch (err) {
			setError(err.message || "SOIC data could not be loaded.");
			setFleetMetrics(EMPTY_METRICS);
			setActiveAlerts([]);
			setAllAlerts([]);
			setHealthScores([]);
			setWatchlist([]);
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => {
		let isActive = true;

		Promise.resolve().then(() => {
			if (isActive) {
				fetchOperationsData();
			}
		});

		return () => {
			isActive = false;
		};
	}, [fetchOperationsData]);

	const criticalAlerts = useMemo(
		() => activeAlerts.filter((alert) => ["P4", "P5"].includes(alert.priority)),
		[activeAlerts]
	);

	const sidebarTabClass = (tabId) =>
		activeTab === tabId
			? "w-full rounded-xl border border-amber-300 bg-gradient-to-r from-amber-100 to-orange-50 px-3 py-2.5 text-left text-sm font-semibold text-amber-900 shadow-sm"
			: "w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-left text-sm font-semibold text-slate-700 transition hover:border-amber-200 hover:bg-amber-50/70 hover:text-amber-900";

	const mobileTabClass = (tabId) =>
		activeTab === tabId
			? "rounded-full bg-slate-900 px-4 py-2 text-xs font-bold text-white shadow"
			: "rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-600";

	return (
		<div className="min-h-screen bg-[radial-gradient(circle_at_12%_16%,#d7f8e7_0,transparent_42%),radial-gradient(circle_at_88%_20%,#d8e9ff_0,transparent_44%),linear-gradient(135deg,#eff4fb_0%,#edf8ff_100%)]">
			<aside className="fixed inset-y-0 left-0 z-40 hidden w-64 border-r border-slate-200/80 bg-white/88 px-5 pb-6 pt-8 shadow-lg backdrop-blur-md lg:flex lg:flex-col">
				<div className="mb-8 px-4">
					<p className="text-lg font-black leading-none text-slate-900">SolarWiser</p>
					<p className="mt-1 text-[10px] uppercase tracking-[0.2em] text-slate-500">Energy Management</p>
				</div>

				<nav className="space-y-2">
					<p className="rounded-xl border-l-4 border-amber-500 bg-gradient-to-r from-amber-100/80 to-transparent px-3 py-2 text-sm font-semibold text-amber-800">
						Operations Center
					</p>
					{tabs.map((tab) => (
						<button
							key={tab.id}
							type="button"
							className={sidebarTabClass(tab.id)}
							onClick={() => setActiveTab(tab.id)}
						>
							{tab.label}
						</button>
					))}
				</nav>

				<div className="mt-auto space-y-3">
					<div className="rounded-xl border border-slate-200 bg-slate-50/80 p-3">
						<p className="text-xs font-bold uppercase tracking-wide text-slate-500">Signal Status</p>
						<div className="mt-2 flex items-center justify-between gap-3">
							<span className="text-sm font-bold text-slate-900">{criticalAlerts.length ? "Attention" : "Stable"}</span>
							<span className={`h-2.5 w-2.5 rounded-full ${criticalAlerts.length ? "bg-rose-500" : "bg-emerald-500"}`} />
						</div>
					</div>
					<button
						type="button"
						className="w-full rounded-xl bg-gradient-to-r from-emerald-600 to-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow transition hover:-translate-y-0.5 hover:shadow-lg"
						onClick={() => navigate("/")}
					>
						Back to Users
					</button>
				</div>
			</aside>

			<header className="sticky top-0 z-30 border-b border-slate-200/70 bg-white/80 px-3 py-3 backdrop-blur-xl sm:px-4 lg:pl-[17.5rem] lg:pr-8">
				<div className="mx-auto flex max-w-7xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
					<div>
						<div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500 sm:text-xs">Operations Intelligence</div>
						<p className="text-sm font-bold text-slate-800 lg:hidden">SOIC Dashboard</p>
					</div>
					<div className="flex flex-wrap items-center gap-2 sm:justify-end">
						{lastUpdated && (
							<span className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-500">
								Updated {lastUpdated.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
							</span>
						)}
						<button
							type="button"
							onClick={() => fetchOperationsData({ forceRefresh: true })}
							className="rounded-full border border-emerald-300 bg-emerald-50 px-4 py-1.5 text-xs font-bold text-emerald-700 transition hover:bg-emerald-100 disabled:cursor-wait disabled:opacity-70"
							disabled={loading}
						>
							{loading ? "Refreshing" : "Refresh"}
						</button>
						<button
							type="button"
							onClick={() => navigate("/")}
							className="rounded-full border border-slate-300 bg-white px-4 py-1.5 text-xs font-bold text-slate-700 transition hover:bg-slate-50 lg:hidden"
						>
							Users
						</button>
					</div>
				</div>
			</header>

			<div className="px-3 pt-3 sm:px-4 lg:hidden">
				<div className="mx-auto flex max-w-7xl gap-2 overflow-x-auto pb-1">
					{tabs.map((tab) => (
						<button
							key={tab.id}
							type="button"
							className={mobileTabClass(tab.id)}
							onClick={() => setActiveTab(tab.id)}
						>
							{tab.shortLabel}
						</button>
					))}
				</div>
			</div>

			<main className="px-3 py-5 sm:px-4 sm:py-6 lg:pl-[17.5rem] lg:pr-8">
				<div className="mx-auto max-w-7xl space-y-5">
					<section className="relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white/88 shadow-lg">
						<div className="absolute inset-0 bg-[radial-gradient(circle_at_82%_20%,rgba(245,158,11,0.18),transparent_35%),radial-gradient(circle_at_18%_82%,rgba(16,185,129,0.16),transparent_40%)]" />
						<div className="relative grid gap-5 p-5 sm:p-6 lg:grid-cols-[1fr_20rem] lg:items-end">
							<div className="space-y-2">
								<p className="inline-block rounded-full bg-amber-100 px-3 py-1 text-xs font-bold uppercase tracking-wide text-amber-800">SOIC</p>
								<h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl md:text-4xl">Solar Operations Intelligence Center</h1>
								<p className="max-w-3xl text-sm text-slate-600 sm:text-base">
									Fleet health, alert urgency, degradation signals, and recovery status in one operations view.
								</p>
							</div>
							<div className="grid grid-cols-3 gap-2 rounded-2xl border border-white/80 bg-white/72 p-3 shadow-sm backdrop-blur">
								<div>
									<p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Alerts</p>
									<p className="mt-1 text-2xl font-bold text-slate-900">{activeAlerts.length}</p>
								</div>
								<div>
									<p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Critical</p>
									<p className="mt-1 text-2xl font-bold text-rose-700">{criticalAlerts.length}</p>
								</div>
								<div>
									<p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Watch</p>
									<p className="mt-1 text-2xl font-bold text-amber-700">{watchlist.length}</p>
								</div>
							</div>
						</div>
					</section>

					{error && (
						<div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900 shadow-sm">
							{error}
						</div>
					)}

					{loading ? (
						<div className="rounded-2xl border border-slate-200/80 bg-white/88 p-10 text-center shadow-sm">
							<div className="mx-auto h-12 w-12 animate-spin rounded-full border-4 border-emerald-100 border-t-emerald-600" />
							<p className="mt-4 text-sm font-bold text-slate-700">Loading operations intelligence...</p>
						</div>
					) : (
						<>
							{activeTab === "overview" && (
								<>
									<SOICFleetOverview
										metrics={fleetMetrics}
										healthScores={healthScores}
										activeAlerts={activeAlerts}
										watchlist={watchlist}
									/>

									<div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
										<div className="lg:col-span-2">
											<SOICActiveAlerts alerts={activeAlerts} />
										</div>
										<SOICCriticalSites alerts={activeAlerts} healthScores={healthScores} />
									</div>

									<div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
										<SOICBestPerformers metrics={fleetMetrics} />
										<SOICDegradedSites metrics={fleetMetrics} />
									</div>

									<div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
										<SOICWatchlist items={watchlist} />
										<SOICRecoveredSites alerts={allAlerts} />
									</div>
								</>
							)}

							{activeTab === "alerts" && <SOICActiveAlerts alerts={activeAlerts} fullPage />}
							{activeTab === "watchlist" && <SOICWatchlist items={watchlist} fullPage />}
							{activeTab === "critical" && <SOICCriticalSites alerts={activeAlerts} healthScores={healthScores} fullPage />}
						</>
					)}
				</div>
			</main>
		</div>
	);
};

export default SOICDashboard;
