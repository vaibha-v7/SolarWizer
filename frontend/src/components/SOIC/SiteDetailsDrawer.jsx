import { getFriendlyMessage, priorityMeta } from "./alertCopy";

const siteLabel = (name, userId) => {
	const label = String(name || "").trim();
	if (label) return label;
	const id = String(userId || "unknown");
	if (id === "unknown") return "Unknown Site";
	return `Deleted Site (${id.slice(-6).toUpperCase()})`;
};

const formatDate = (value) => {
	if (!value) return "Unknown";
	const date = new Date(value);
	if (Number.isNaN(date.getTime())) return "Unknown";
	return date.toLocaleDateString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
};

const SiteDetailsDrawer = ({ siteId, isOpen, onClose, allAlerts = [] }) => {
	if (!isOpen || !siteId) return null;

	const siteAlerts = allAlerts.filter(a => String(a.user_id) === String(siteId));
	const activeSiteAlerts = siteAlerts.filter(a => ["CREATED", "ACTIVE", "ESCALATED"].includes(a.status));
	
	// Grab info from the most recent alert for this site
	const latestAlert = siteAlerts.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0))[0] || {};
	
	const siteName = siteLabel(latestAlert.user_name || latestAlert.site_name, siteId);
	
	// Determine Connection Status
	const isOffline = activeSiteAlerts.some(a => a.alert_type?.includes("NO_REALTIME_DATA") || a.title?.includes("No real-time data") || a.title?.includes("offline"));
	const currentStatus = isOffline ? "Not Connected" : (activeSiteAlerts.length > 0 ? "Underperforming" : "Healthy");
	
	const actual = latestAlert.actual_generation_kwh !== undefined ? Number(latestAlert.actual_generation_kwh).toFixed(1) : null;
	const expected = latestAlert.predicted_generation_kwh ? Number(latestAlert.predicted_generation_kwh).toFixed(1) : null;
	const lastTelemetry = formatDate(latestAlert.last_telemetry_time || latestAlert.updated_at);

	return (
		<>
			<div 
				className="fixed inset-0 z-40 bg-slate-900/20 backdrop-blur-sm transition-opacity"
				onClick={onClose}
			/>

			<div className="fixed inset-y-0 right-0 z-50 w-full max-w-md overflow-y-auto bg-white shadow-2xl transition-transform border-l border-slate-200">
				<div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 bg-slate-50">
					<h2 className="text-lg font-bold text-slate-900">{siteName}</h2>
					<button 
						onClick={onClose}
						className="rounded p-2 text-slate-400 hover:bg-slate-200 hover:text-slate-600 transition"
					>
						✕
					</button>
				</div>

				<div className="p-6 space-y-6">
					
					{/* Status Overview */}
					<div className="grid grid-cols-2 gap-4">
						<div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
							<p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Current Status</p>
							<div className="mt-2 flex items-center gap-2">
								<span className="font-medium text-sm text-slate-900">{currentStatus}</span>
							</div>
						</div>
						<div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
							<p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Connection</p>
							<div className="mt-2 flex items-center gap-2">
								<span className={`h-2.5 w-2.5 rounded-full ${isOffline ? "bg-red-500" : "bg-green-500"}`} />
								<span className="font-medium text-sm text-slate-900">{isOffline ? "Offline" : "Online"}</span>
							</div>
						</div>
					</div>

					<div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
						<p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-4">Telemetry Data</p>
						<div className="space-y-4">
							<div className="flex justify-between border-b border-slate-100 pb-3">
								<span className="text-sm font-semibold text-slate-500">Expected Output</span>
								<span className="text-sm font-medium text-slate-900">{isOffline || !expected ? "—" : `${expected} kW`}</span>
							</div>
							<div className="flex justify-between border-b border-slate-100 pb-3">
								<span className="text-sm font-semibold text-slate-500">Actual Output</span>
								<span className="text-sm font-medium text-slate-900">{isOffline || !actual ? "—" : `${actual} kW`}</span>
							</div>
							<div className="flex justify-between">
								<span className="text-sm font-semibold text-slate-500">Last Telemetry</span>
								<span className="text-sm font-medium text-slate-900">{lastTelemetry}</span>
							</div>
						</div>
					</div>

					{/* Active Alerts */}
					<div>
						<h3 className="text-sm font-bold text-slate-900 mb-3 flex items-center gap-2">
							Open Alerts 
							<span className="rounded bg-slate-100 px-2 py-0.5 text-[10px] text-slate-600">{activeSiteAlerts.length}</span>
						</h3>
						{activeSiteAlerts.length > 0 ? (
							<div className="space-y-3">
								{activeSiteAlerts.map(alert => {
									const meta = priorityMeta[alert.priority] || priorityMeta.P0;
									const message = getFriendlyMessage(alert.short_message || alert.title || "");
									return (
										<div key={alert._id} className="rounded border border-slate-200 p-3 flex items-start gap-3 shadow-sm bg-white">
											<span className={`inline-flex min-w-[3.5rem] justify-center rounded px-2 py-0.5 text-[10px] font-bold ${meta.color}`}>
												{meta.label}
											</span>
											<div>
												<p className="text-sm font-bold text-slate-800">{message}</p>
												<p className="text-xs font-semibold text-slate-500 mt-0.5">{formatDate(alert.created_at || alert.triggered_at)}</p>
											</div>
										</div>
									);
								})}
							</div>
						) : (
							<p className="text-sm text-slate-500 font-bold">No active alerts for this site.</p>
						)}
					</div>
					
				</div>
			</div>
		</>
	);
};

export default SiteDetailsDrawer;
