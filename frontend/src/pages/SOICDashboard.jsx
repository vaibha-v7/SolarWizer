import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import SOICActiveAlerts from "../components/SOIC/SOICActiveAlerts";
import SOICCriticalSites from "../components/SOIC/SOICCriticalSites";
import SOICLiveSites from "../components/SOIC/SOICLiveSites";
import {
	fetchSOICDashboard
} from "../services/soicApi";

const EMPTY_METRICS = {
	total_sites: 0,
	offline_sites: 0
};

const tabs = [
	{ id: "overview", label: "Overview", shortLabel: "Overview" },
	{ id: "alerts", label: "Active Alerts", shortLabel: "Alerts" },
	{ id: "critical", label: "Critical Sites", shortLabel: "Critical" }
];

const severityRank = {
	CRITICAL: 4,
	HIGH: 3,
	MEDIUM: 2,
	LOW: 1,
	HEALTHY: 0
};

const sortAlertsByUrgency = (alerts) =>
	[...alerts].sort((left, right) => {
		const rankDelta = (severityRank[right.severity] ?? -1) - (severityRank[left.severity] ?? -1);
		if (rankDelta !== 0) return rankDelta;
		return (right.alert_days_10d || 0) - (left.alert_days_10d || 0);
	});

const SOICDashboard = () => {
	const navigate = useNavigate();
	const [fleetMetrics, setFleetMetrics] = useState(EMPTY_METRICS);
	const [activeAlerts, setActiveAlerts] = useState([]);
	const [liveSites, setLiveSites] = useState([]);
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
			
			const combinedAlerts = [
				...(Array.isArray(dashboard?.connectivityIssues) ? dashboard.connectivityIssues : []),
				...(Array.isArray(dashboard?.activeGenerationIssues) ? dashboard.activeGenerationIssues : [])
			];
			setActiveAlerts(sortAlertsByUrgency(combinedAlerts));
			setLiveSites(Array.isArray(dashboard?.liveConnectedSites) ? dashboard.liveConnectedSites : []);
			setLastUpdated(new Date());
		} catch (err) {
			setError(err.message || "SOIC data could not be loaded.");
			setFleetMetrics(EMPTY_METRICS);
			setActiveAlerts([]);
			setLiveSites([]);
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => {
		let isActive = true;
		Promise.resolve().then(() => {
			if (isActive) fetchOperationsData();
		});
		return () => { isActive = false; };
	}, [fetchOperationsData]);

	const criticalAlerts = useMemo(
		() => activeAlerts.filter((alert) => alert.severity === "CRITICAL"),
		[activeAlerts]
	);

	const offlineCount = useMemo(() => {
		return activeAlerts.filter(a => a.status === "Not Connected").length;
	}, [activeAlerts]);

	const totalSites = fleetMetrics.total_sites || 0;
	const connectedSites = Math.max(0, totalSites - offlineCount);

	const sidebarTabClass = (tabId) =>
		activeTab === tabId
			? "w-full rounded-xl border-l-4 border-emerald-500 bg-gradient-to-r from-emerald-100/80 to-transparent px-3 py-2 text-left text-sm font-semibold text-emerald-800 transition"
			: "w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-left text-sm font-semibold text-slate-700 transition hover:bg-slate-50";

	const mobileTabClass = (tabId) =>
		activeTab === tabId
			? "rounded-full bg-emerald-600 px-4 py-2 text-xs font-bold text-white shadow"
			: "rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-600";

	return (
		<div className="min-h-screen bg-[radial-gradient(circle_at_12%_16%,#d7f8e7_0,transparent_42%),radial-gradient(circle_at_88%_20%,#d8e9ff_0,transparent_44%),linear-gradient(135deg,#eff4fb_0%,#edf8ff_100%)]">
			<aside className="fixed inset-y-0 left-0 z-40 hidden w-64 border-r border-slate-200/80 bg-white/88 px-5 pb-6 pt-8 shadow-lg backdrop-blur-md lg:flex lg:flex-col">
				<div className="mb-8 px-4">
					<p className="text-lg font-black leading-none text-slate-900">SolarWiser</p>
					<p className="mt-1 text-[10px] uppercase tracking-[0.2em] text-slate-500">Energy Management</p>
				</div>

				<nav className="space-y-1">
					<p className="mb-2 px-3 text-xs font-bold uppercase tracking-wider text-slate-400">
						Operations Mode
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
					<div className="rounded-xl border border-slate-200 bg-white/60 backdrop-blur p-3">
						<p className="text-xs font-bold uppercase tracking-wide text-slate-500">System Status</p>
						<div className="mt-2 flex items-center justify-between gap-3">
							<span className="text-sm font-bold text-slate-900">{criticalAlerts.length ? "Critical Alerts Active" : "All Clear"}</span>
							<span className={`h-2.5 w-2.5 rounded-full ${criticalAlerts.length ? "bg-red-500" : "bg-green-500"}`} />
						</div>
					</div>
					<button
						type="button"
						className="w-full rounded-xl bg-gradient-to-r from-emerald-600 to-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow transition hover:-translate-y-0.5 hover:shadow-lg"
						onClick={() => navigate("/")}
					>
						Exit Operations
					</button>
				</div>
			</aside>

			<header className="sticky top-0 z-30 border-b border-slate-200/70 bg-white/80 px-3 py-3 backdrop-blur-xl sm:px-4 lg:pl-[17.5rem] lg:pr-8">
				<div className="mx-auto flex max-w-7xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
					<div>
						<div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500 sm:text-xs">Dashboard Console</div>
						<h1 className="text-xl font-bold text-slate-900">Operations Control</h1>
					</div>
					<div className="flex flex-wrap items-center gap-3 sm:justify-end">
						{lastUpdated && (
							<span className="text-xs font-medium text-slate-500">
								Last updated: {lastUpdated.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
							</span>
						)}
						<button
							type="button"
							onClick={() => fetchOperationsData({ forceRefresh: true })}
							className="rounded border border-slate-300 bg-white px-4 py-1.5 text-xs font-bold text-slate-700 transition hover:bg-slate-50 disabled:cursor-wait disabled:opacity-70"
							disabled={loading}
						>
							{loading ? "Refreshing..." : "Refresh"}
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
					{error && (
						<div className="rounded border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-900">
							{error}
						</div>
					)}

					{loading ? (
						<div className="py-12 text-center">
							<p className="text-sm font-bold text-slate-500">Loading fleet data...</p>
						</div>
					) : (
						<>
							{activeTab === "overview" && (
								<div className="space-y-6">
									{/* TOP METRICS ROW */}
									<div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
										<div className="rounded-2xl border border-slate-200/80 bg-white/88 p-4 shadow-sm">
											<p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Total Sites</p>
											<p className="mt-2 text-2xl font-bold text-slate-900">{totalSites}</p>
										</div>
										<div className="rounded-2xl border border-slate-200/80 bg-white/88 p-4 shadow-sm">
											<p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Connected Sites</p>
											<p className="mt-2 text-2xl font-bold text-slate-900">{connectedSites}</p>
										</div>
										<div className="rounded-2xl border border-slate-200/80 bg-white/88 p-4 shadow-sm">
											<p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Active Alerts</p>
											<p className="mt-2 text-2xl font-bold text-slate-900">{activeAlerts.length}</p>
										</div>
										<div className="rounded-2xl border border-rose-200/80 bg-white/88 p-4 shadow-sm">
											<p className="text-xs font-semibold uppercase tracking-wider text-rose-600">Critical Sites</p>
											<p className="mt-2 text-2xl font-bold text-rose-600">{criticalAlerts.length}</p>
										</div>
									</div>

									{/* MAIN SECTION */}
									<SOICActiveAlerts alerts={activeAlerts} fullPage={false} />
									<SOICLiveSites sites={liveSites} />
								</div>
							)}

							{activeTab === "alerts" && <SOICActiveAlerts alerts={activeAlerts} fullPage={true} />}
							{activeTab === "critical" && <SOICCriticalSites alerts={activeAlerts} fullPage={true} />}
						</>
					)}
				</div>
			</main>
		</div>
	);
};

export default SOICDashboard;
