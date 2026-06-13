import { useState } from "react";
import { getFriendlyMessage, priorityMeta } from "./alertCopy";

const siteLabel = (name, userId) => {
	const label = String(name || "").trim();
	if (label) return label;
	const id = String(userId || "unknown");
	if (id === "unknown") return "Unknown Site";
	return `Deleted Site (${id.slice(-6).toUpperCase()})`;
};

const formatDate = (value) => {
	if (!value) return "";
	const date = new Date(value);
	if (Number.isNaN(date.getTime())) return "";
	return date.toLocaleDateString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
};

const SiteDetailsDrawer = ({ siteId, isOpen, onClose, allAlerts = [] }) => {
	const [showTechDetails, setShowTechDetails] = useState(false);

	if (!isOpen || !siteId) return null;

	const siteAlerts = allAlerts.filter(a => String(a.user_id) === String(siteId));
	
	const activeSiteAlerts = siteAlerts.filter(a => ["CREATED", "ACTIVE", "ESCALATED"].includes(a.status));
	const recoveredAlerts = siteAlerts.filter(a => ["RESOLVED", "AUTO_RESOLVED"].includes(a.status));
	
	// Grab info from the most recent alert for this site
	const latestAlert = siteAlerts.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0))[0] || {};
	
	const siteName = siteLabel(latestAlert.user_name || latestAlert.site_name, siteId);
	
	// Determine Connection Status
	const isOffline = activeSiteAlerts.some(a => a.alert_type?.includes("NO_REALTIME_DATA") || a.title?.includes("No real-time data") || a.title?.includes("offline"));
	
	const actual = latestAlert.actual_generation_kwh;
	const expected = latestAlert.predicted_generation_kwh;

	return (
		<>
			{/* Backdrop */}
			<div 
				className="fixed inset-0 z-40 bg-slate-900/20 backdrop-blur-sm transition-opacity"
				onClick={onClose}
			/>

			{/* Drawer */}
			<div className="fixed inset-y-0 right-0 z-50 w-full max-w-md overflow-y-auto bg-white shadow-2xl transition-transform border-l border-slate-200">
				<div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
					<h2 className="text-lg font-bold text-slate-900">{siteName}</h2>
					<button 
						onClick={onClose}
						className="rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition"
					>
						✕
					</button>
				</div>

				<div className="p-6 space-y-6">
					
					{/* Status Overview */}
					<div className="grid grid-cols-2 gap-4">
						<div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
							<p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Connection Status</p>
							<div className="mt-2 flex items-center gap-2">
								<span className={`h-2.5 w-2.5 rounded-full ${isOffline ? "bg-rose-500" : "bg-emerald-500"}`} />
								<span className="font-bold text-slate-900">{isOffline ? "Not Connected" : "Online"}</span>
							</div>
						</div>
						
						{(expected > 0) && actual !== undefined ? (
							<div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
								<p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Output Status</p>
								<div className="mt-2">
									<p className="font-bold text-slate-900">{Number(actual).toFixed(1)} kW <span className="text-xs font-medium text-slate-500">actual</span></p>
									<p className="text-xs font-medium text-slate-500 mt-0.5">{Number(expected).toFixed(1)} kW expected</p>
								</div>
							</div>
						) : (
							<div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
								<p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Output Status</p>
								<div className="mt-2">
									<span className="font-bold text-slate-400">No data available</span>
								</div>
							</div>
						)}
					</div>

					{/* Active Alerts */}
					<div>
						<h3 className="text-sm font-bold text-slate-900 mb-3 flex items-center gap-2">
							Active Alerts 
							<span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-600">{activeSiteAlerts.length}</span>
						</h3>
						{activeSiteAlerts.length > 0 ? (
							<div className="space-y-3">
								{activeSiteAlerts.map(alert => {
									const meta = priorityMeta[alert.priority] || priorityMeta.P0;
									const message = getFriendlyMessage(alert.short_message || alert.title || "");
									return (
										<div key={alert._id} className="rounded-lg border border-slate-100 p-3 flex items-start gap-3">
											<span className={`inline-flex min-w-[3.5rem] justify-center rounded-full border px-2 py-0.5 text-[10px] font-black ${meta.color}`}>
												{meta.label}
											</span>
											<div>
												<p className="text-sm font-semibold text-slate-800">{message}</p>
												<p className="text-xs text-slate-500 mt-0.5">{formatDate(alert.created_at || alert.triggered_at)}</p>
											</div>
										</div>
									);
								})}
							</div>
						) : (
							<p className="text-sm text-slate-500 italic">No active alerts</p>
						)}
					</div>

					{/* Recent Recoveries */}
					<div>
						<h3 className="text-sm font-bold text-slate-900 mb-3 flex items-center gap-2">
							Recent Recoveries
							<span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-600">{recoveredAlerts.length}</span>
						</h3>
						{recoveredAlerts.length > 0 ? (
							<div className="space-y-3">
								{recoveredAlerts.slice(0, 3).map(alert => {
									const message = getFriendlyMessage(alert.short_message || alert.title || "");
									return (
										<div key={alert._id} className="rounded-lg border border-slate-100 bg-emerald-50/30 p-3">
											<div className="flex justify-between items-start gap-2">
												<p className="text-sm font-semibold text-slate-800">{message}</p>
												<span className="shrink-0 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-black text-emerald-700 uppercase tracking-wide">
													{alert.status === "AUTO_RESOLVED" ? "Auto" : "Manual"}
												</span>
											</div>
											<p className="text-xs text-slate-500 mt-1">Resolved: {formatDate(alert.resolved_at || alert.updated_at)}</p>
										</div>
									);
								})}
								{recoveredAlerts.length > 3 && (
									<p className="text-xs text-center text-slate-400">+{recoveredAlerts.length - 3} older recoveries</p>
								)}
							</div>
						) : (
							<p className="text-sm text-slate-500 italic">No recent recoveries</p>
						)}
					</div>

					{/* Technical Details (Collapsed by default) */}
					<div className="border-t border-slate-100 pt-6 mt-6">
						<button 
							onClick={() => setShowTechDetails(!showTechDetails)}
							className="text-xs font-bold uppercase tracking-wide text-slate-400 hover:text-slate-600 transition flex items-center gap-1"
						>
							Technical Details {showTechDetails ? "▼" : "▶"}
						</button>
						
						{showTechDetails && (
							<div className="mt-3 grid grid-cols-1 gap-2 rounded-lg bg-slate-50 p-4 text-xs text-slate-600">
								<div className="flex justify-between border-b border-slate-100 pb-2">
									<span className="font-semibold">Site ID:</span>
									<span className="font-mono">{latestAlert.site_id || "N/A"}</span>
								</div>
								<div className="flex justify-between border-b border-slate-100 pb-2">
									<span className="font-semibold">Inverter SN:</span>
									<span className="font-mono">{latestAlert.inverter_sn || "N/A"}</span>
								</div>
								<div className="flex justify-between pb-1">
									<span className="font-semibold">Internal User ID:</span>
									<span className="font-mono text-[10px]">{siteId}</span>
								</div>
							</div>
						)}
					</div>
					
				</div>
			</div>
		</>
	);
};

export default SiteDetailsDrawer;
