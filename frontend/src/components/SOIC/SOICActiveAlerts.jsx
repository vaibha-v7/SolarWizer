import { useState } from "react";
import { getFriendlyAlertType, getFriendlyMessage, getFriendlyRecommendation, priorityMeta } from "./alertCopy";

const priorityRank = { P5: 5, P4: 4, P3: 3, P2: 2, P1: 1, P0: 0 };

const formatAge = (value) => {
	if (!value) return "";
	const date = new Date(value);
	if (Number.isNaN(date.getTime())) return "";
	
	const diffMs = new Date() - date;
	if (diffMs < 0) return "Just now";
	
	const diffMins = Math.floor(diffMs / 60000);
	const diffHrs = Math.floor(diffMins / 60);
	const diffDays = Math.floor(diffHrs / 24);
	
	if (diffDays > 0) {
		const remHrs = diffHrs % 24;
		return `Active for ${diffDays}d ${remHrs}h`;
	}
	if (diffHrs > 0) {
		const remMins = diffMins % 60;
		return `Active for ${diffHrs}h ${remMins}m`;
	}
	if (diffMins > 0) {
		return `Active for ${diffMins}m`;
	}
	return "Active for < 1m";
};

const siteLabel = (name, userId) => {
	const label = String(name || "").trim();
	if (label) return label;
	const id = String(userId || "unassigned");
	if (id === "unassigned") return "Unknown Site";
	return `Deleted Site (${id.slice(-6).toUpperCase()})`;
};

const EmptyAlerts = () => (
	<div className="px-5 py-12 text-center">
		<div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-2xl">
			✅
		</div>
		<p className="mt-3 text-sm font-bold text-slate-700">No alerts right now</p>
		<p className="mt-1 text-xs text-slate-500">All your sites are running smoothly.</p>
	</div>
);

const AlertItem = ({ alert, showDetails, onResolve }) => {
	const meta = priorityMeta[alert.priority] || priorityMeta.P0;
	const alertType = getFriendlyAlertType(alert.alert_type || alert.title || "");
	const message = getFriendlyMessage(alert.short_message || alert.title || "");
	const description = getFriendlyMessage(alert.description || "");
	const recommendation = getFriendlyRecommendation(
		Array.isArray(alert.maintenance_recommendations) && alert.maintenance_recommendations.length
			? alert.maintenance_recommendations[0]
			: ""
	);
	const when = formatAge(alert.triggered_at || alert.created_at);

	return (
		<div className="mt-3 rounded-lg border border-slate-100 bg-white p-3 shadow-sm">
			<div className="flex items-start gap-3">
				<div className="flex flex-col items-center gap-1 pt-0.5">
					<span className={`inline-flex min-w-[3.5rem] justify-center rounded-full border px-2.5 py-1 text-[10px] font-black ${meta.color}`}>
						{meta.label}
					</span>
				</div>
				<div className="min-w-0 flex-1">
					<div className="flex flex-wrap items-center gap-2">
						<span className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-600">
							{alertType}
						</span>
						{when && <span className="ml-auto text-xs font-medium text-slate-400">{when}</span>}
					</div>

					<p className="mt-1.5 text-sm font-semibold text-slate-800">{message}</p>

					{showDetails && description && description !== message && (
						<p className="mt-1 text-xs text-slate-600">{description}</p>
					)}

					{showDetails && (alert.predicted_generation_kwh > 0) && alert.actual_generation_kwh !== undefined && (
						<div className="mt-2 grid grid-cols-2 gap-2 rounded bg-slate-50 p-2 text-xs border border-slate-100">
							<div>
								<p className="text-slate-500 font-medium">Expected Output</p>
								<p className="font-bold text-slate-700">{Number(alert.predicted_generation_kwh).toFixed(1)} kW</p>
							</div>
							<div>
								<p className="text-slate-500 font-medium">Actual Output</p>
								<p className="font-bold text-slate-700">{Number(alert.actual_generation_kwh).toFixed(1)} kW</p>
							</div>
							<div>
								<p className="text-slate-500 font-medium">Deviation</p>
								<p className="font-bold text-rose-600">
									{(((Number(alert.actual_generation_kwh) - Number(alert.predicted_generation_kwh)) / Number(alert.predicted_generation_kwh)) * 100).toFixed(0)}%
								</p>
							</div>
							<div>
								<p className="text-slate-500 font-medium">Cause</p>
								<p className="font-bold text-slate-700">{alertType}</p>
							</div>
						</div>
					)}

					{showDetails && recommendation && (
						<div className="mt-3 flex items-start gap-2 rounded-lg border border-emerald-100 bg-emerald-50 px-3 py-2.5">
							<span className="text-base leading-none mt-0.5">💡</span>
							<div>
								<p className="text-[10px] font-bold uppercase tracking-wider text-emerald-600">Recommended Action</p>
								<p className="mt-0.5 text-xs font-semibold text-emerald-900">{recommendation}</p>
							</div>
						</div>
					)}
					{showDetails && onResolve && (
						<div className="mt-3 flex justify-end">
							<button
								type="button"
								className="rounded-full border border-emerald-200 bg-emerald-50 px-4 py-1.5 text-xs font-bold text-emerald-700 transition hover:bg-emerald-100 hover:border-emerald-300"
								onClick={() => onResolve(alert._id, "Manual Resolution")}
							>
								Resolve Alert
							</button>
						</div>
					)}
				</div>
			</div>
		</div>
	);
};

const SiteAlertGroup = ({ userId, userName, siteName, alerts, showDetails, onResolve, onSiteClick }) => {
	const [expanded, setExpanded] = useState(false);
	const site = siteLabel(userName || siteName, userId);
	
	const highestPriority = alerts.reduce((max, a) => {
		const currentRank = priorityRank[a.priority] ?? -1;
		return currentRank > priorityRank[max] ? a.priority : max;
	}, alerts[0].priority);
	const meta = priorityMeta[highestPriority] || priorityMeta.P0;

	const isConnectivity = alerts.some(a => a.alert_type?.includes("NO_REALTIME_DATA") || a.title?.includes("No real-time data"));
	const topAlert = alerts[0];
	const actualKw = topAlert.actual_generation_kwh !== undefined ? Number(topAlert.actual_generation_kwh).toFixed(1) : null;
	const predictedKw = topAlert.predicted_generation_kwh !== undefined ? Number(topAlert.predicted_generation_kwh).toFixed(1) : null;

	return (
		<div className="group border-b border-slate-100 px-4 py-4 transition hover:bg-slate-50/50 sm:px-5">
			<div className="flex w-full items-start justify-between text-left">
				<div className="flex flex-col gap-1 w-full pr-4">
					<div className="flex items-center gap-2">
						<button 
							onClick={() => onSiteClick && onSiteClick(userId)}
							className="text-sm font-bold text-slate-900 hover:text-amber-700 hover:underline text-left transition"
						>
							{site}
						</button>
						<span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${isConnectivity ? 'bg-slate-100 text-slate-600' : 'bg-emerald-100 text-emerald-700'}`}>
							{isConnectivity ? 'No Telemetry' : 'Connected'}
						</span>
					</div>
					
					<div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1">
						<span className={`text-xs font-bold flex items-center gap-1 ${meta.color.split(' ')[0]}`}>
							{meta.icon || '🔴'} {meta.label}
						</span>
						
						{!isConnectivity && actualKw !== null && predictedKw !== null && (
							<span className="text-xs font-semibold text-slate-700">
								{actualKw} kW / {predictedKw} kW
							</span>
						)}
						
						<span className="text-xs font-medium text-slate-500">
							{alerts.length} Active {alerts.length === 1 ? 'Alert' : 'Alerts'}
						</span>
					</div>
				</div>
				<button onClick={() => setExpanded(!expanded)} className="text-slate-400 p-2 hover:bg-slate-100 rounded shrink-0">
					{expanded ? "▲" : "▼"}
				</button>
			</div>
			
			{expanded && (
				<div className="mt-2 pl-5">
					{alerts.map(a => (
						<AlertItem 
							key={a._id || `${a.user_id}-${a.priority}-${a.alert_type}`} 
							alert={a} 
							showDetails={showDetails} 
							onResolve={onResolve} 
						/>
					))}
				</div>
			)}
		</div>
	);
};

const SOICActiveAlerts = ({ alerts = [], fullPage = false, onResolve, onSiteClick }) => {
	const [activeFilter, setActiveFilter] = useState("All");

	const filteredAlerts = alerts.filter(a => {
		if (activeFilter === "All") return true;
		if (activeFilter === "Critical") return ["P4", "P5"].includes(a.priority);
		if (activeFilter === "Warning") return a.priority === "P3";
		if (activeFilter === "Review") return a.priority === "P2";
		if (activeFilter === "Info") return ["P0", "P1"].includes(a.priority) && !a.alert_type?.includes("NO_REALTIME_DATA");
		if (activeFilter === "Connectivity") return a.alert_type?.includes("NO_REALTIME_DATA") || a.title?.includes("No real-time data");
		return true;
	});

	const sorted = [...filteredAlerts]
		.sort((a, b) => (priorityRank[b.priority] ?? -1) - (priorityRank[a.priority] ?? -1));

	// Group by site
	const grouped = sorted.reduce((acc, alert) => {
		const key = alert.user_id || "unassigned";
		if (!acc[key]) acc[key] = { userId: key, userName: alert.user_name, siteName: alert.site_name, alerts: [] };
		acc[key].alerts.push(alert);
		return acc;
	}, {});

	const siteGroups = Object.values(grouped);
	const visibleGroups = fullPage ? siteGroups : siteGroups.slice(0, 5);

	const urgentCount = alerts.filter((a) => ["P4", "P5"].includes(a.priority)).length;

	return (
		<section className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white/90 shadow-sm flex flex-col h-full">
			<div className="flex flex-col gap-3 border-b border-slate-200/70 bg-slate-50/70 px-4 py-3 sm:px-5">
				<div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
					<div>
						<p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">What Needs Attention</p>
						<h2 className="mt-1 text-lg font-bold text-slate-900">Active Alerts</h2>
					</div>
					<div className="flex items-center gap-2">
						{urgentCount > 0 && (
							<span className="rounded-full bg-rose-100 px-3 py-1 text-xs font-bold text-rose-700">
								🚨 {urgentCount} urgent
							</span>
						)}
						<span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">
							{alerts.length} total
						</span>
					</div>
				</div>
				
				<div className="flex overflow-x-auto pb-1 gap-2 mt-1 scrollbar-hide">
					{["All", "Critical", "Warning", "Review", "Info", "Connectivity"].map(f => (
						<button
							key={f}
							onClick={() => setActiveFilter(f)}
							className={`shrink-0 rounded-full px-3 py-1 text-xs font-bold transition ${
								activeFilter === f 
									? "bg-slate-800 text-white" 
									: "bg-white text-slate-600 border border-slate-200 hover:bg-slate-100"
							}`}
						>
							{f}
						</button>
					))}
				</div>
			</div>

			<div className="flex-1 overflow-auto">
				{visibleGroups.length ? (
					<div>
						{!fullPage && urgentCount > 0 && (
							<div className="border-b border-rose-100 bg-rose-50/40 px-4 py-2 sm:px-5">
								<p className="text-xs font-bold text-rose-600">🚨 Requires urgent action</p>
							</div>
						)}

						{visibleGroups.map((group) => (
							<SiteAlertGroup
								key={group.userId}
								{...group}
								showDetails={fullPage}
								onResolve={onResolve}
								onSiteClick={onSiteClick}
							/>
						))}

						{!fullPage && siteGroups.length > 5 && (
							<div className="border-t border-slate-100 bg-slate-50/60 px-5 py-3 text-center">
								<p className="text-xs font-semibold text-slate-500">
									+{siteGroups.length - 5} more sites — go to the Alerts tab to see all
								</p>
							</div>
						)}
					</div>
				) : (
					<EmptyAlerts />
				)}
			</div>
		</section>
	);
};

export default SOICActiveAlerts;
