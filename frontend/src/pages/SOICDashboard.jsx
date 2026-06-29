import { useCallback, useEffect, useState } from "react";
import React from "react";
import { useNavigate } from "react-router-dom";
import { fetchSOICDashboard, fetchSOICResolvedAlerts, acknowledgeSOICAlert, resolveSOICAlert, fetchSOICSiteHistory, fetchSOICSites } from "../services/soicApi";

const API_BASE_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:5000";

const EMPTY_METRICS = {
	total_sites: 0,
	connected_sites: 0,
	active_sites: 0,
	offline_sites: 0,
	active_alerts: 0,
	critical_sites: 0
};

const SeverityBadge = ({ severity }) => {
	const badges = {
		YELLOW: "bg-yellow-50 text-yellow-700 border-yellow-200/60",
		ORANGE: "bg-orange-50 text-orange-700 border-orange-200/60",
		RED: "bg-red-50 text-red-700 border-red-200/60",
		CRITICAL: "bg-rose-50 text-rose-700 border-rose-200/60 font-bold",
		OFFLINE: "bg-slate-50 text-slate-700 border-slate-200/60",
		RESOLVED: "bg-emerald-50 text-emerald-700 border-emerald-200/60"
	};

	const labels = {
		YELLOW: "Warning",
		ORANGE: "Elevated",
		RED: "Critical",
		CRITICAL: "Critical",
		OFFLINE: "Offline",
		RESOLVED: "Resolved"
	};

	const className = badges[severity] || "bg-slate-50 text-slate-700 border-slate-200/60";
	const label = labels[severity] || severity;

	return (
		<span className={`inline-flex items-center px-2.5 py-1 rounded-md text-[11px] font-semibold border ${className}`}>
			{label}
		</span>
	);
};

const ActiveSitesTable = ({ sites }) => {
	if (!sites || sites.length === 0) {
		return (
			<div className="flex flex-col items-center justify-center p-12 text-center bg-white/60 border border-dashed border-slate-300 rounded-2xl">
				<p className="text-slate-500 font-medium text-sm">No active sites operating normally.</p>
			</div>
		);
	}

	return (
		<section className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white/90 shadow-lg">
			<div className="flex flex-col gap-1 border-b border-slate-200/70 bg-slate-50/70 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
				<h3 className="text-xs font-bold uppercase tracking-[0.14em] text-slate-700">Healthy Fleet</h3>
				<p className="text-xs text-slate-500">Showing {sites.length} operational sites</p>
			</div>
			<div className="overflow-x-auto">
				<table className="w-full text-left text-sm text-slate-700 min-w-[500px]">
					<thead className="bg-slate-50/50 border-b border-slate-200/70 text-[11px] uppercase tracking-wider font-semibold text-slate-500">
						<tr>
							<th className="px-5 py-4">Site Name</th>
							<th className="px-5 py-4">Status</th>
							<th className="px-5 py-4">Last Evaluation</th>
							<th className="px-5 py-4 text-right">Performance</th>
						</tr>
					</thead>
					<tbody className="divide-y divide-slate-100/80">
						{sites.map((site) => (
							<tr key={site.site_id} className="hover:bg-slate-50/60 transition-colors">
								<td className="px-5 py-4 font-semibold text-slate-900">{site.site_name}</td>
								<td className="px-5 py-4">
									<span className={`inline-flex items-center px-2.5 py-1 rounded-md text-[11px] font-semibold border ${
										site.status === "Warning" 
											? "bg-yellow-50 text-yellow-700 border-yellow-200/60"
											: "bg-emerald-50 text-emerald-700 border-emerald-200/60"
									}`}>
										{site.status}
									</span>
								</td>
								<td className="px-5 py-4 text-slate-500 text-[13px]">{site.last_evaluated_date}</td>
								<td className="px-5 py-4 text-right font-mono text-[13px] text-slate-600">{site.performance_percent === null ? "N/A" : `${site.performance_percent}%`}</td>
							</tr>
						))}
					</tbody>
				</table>
			</div>
		</section>
	);
};

const AlertsTable = ({ alerts, onAcknowledge, onResolve, isResolvedTab = false }) => {
	const [expandedRows, setExpandedRows] = useState({});

	const toggleRow = (id) => {
		setExpandedRows(prev => ({ ...prev, [id]: !prev[id] }));
	};

	if (!alerts || alerts.length === 0) {
		return (
			<div className="flex flex-col items-center justify-center p-12 text-center bg-white/60 border border-dashed border-slate-300 rounded-2xl">
				<p className="text-slate-500 font-medium text-sm">No incidents found for this category.</p>
			</div>
		);
	}

	return (
		<section className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white/90 shadow-lg">
			<div className="flex flex-col gap-1 border-b border-slate-200/70 bg-slate-50/70 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
				<h3 className="text-xs font-bold uppercase tracking-[0.14em] text-slate-700">{isResolvedTab ? "Incident History" : "Active Incidents"}</h3>
				<p className="text-xs text-slate-500">Showing {alerts.length} records</p>
			</div>
			<div className="overflow-x-auto">
				<table className="w-full text-left text-sm text-slate-700 min-w-[500px]">
					<thead className="bg-slate-50/50 border-b border-slate-200/70 text-[11px] uppercase tracking-wider font-semibold text-slate-500">
						<tr>
							<th className="px-5 py-4">Site Name</th>
							<th className="px-5 py-4">Severity</th>
							<th className="px-5 py-4 text-right">Days Active</th>
							{!isResolvedTab && <th className="px-5 py-4">Status</th>}
							<th className="px-5 py-4 text-right">Perf %</th>
							<th className="px-5 py-4 text-right">Actions</th>
						</tr>
					</thead>
					<tbody className="divide-y divide-slate-100/80">
						{alerts.map((alert) => (
							<React.Fragment key={alert._id}>
								<tr className="hover:bg-slate-50/60 transition-colors">
									<td className="px-5 py-4 font-semibold text-slate-900">{alert.site_name}</td>
									<td className="px-5 py-4">
										<SeverityBadge severity={isResolvedTab ? "RESOLVED" : alert.severity} />
									</td>
									<td className="px-5 py-4 text-right font-mono text-[13px] text-slate-900 font-medium">{alert.consecutive_days || alert.total_days_active || 0}</td>
									{!isResolvedTab && (
										<td className="px-5 py-4 text-xs font-semibold text-slate-600">{alert.status}</td>
									)}
									<td className="px-5 py-4 text-right font-mono text-[13px] text-slate-500">{alert.performance_percent === null ? "N/A" : `${alert.performance_percent?.toFixed(1)}%`}</td>
									<td className="px-5 py-4 text-right space-x-2">
										<button 
											onClick={() => toggleRow(alert._id)}
											className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-semibold text-slate-700 transition hover:bg-slate-50 shadow-sm"
										>
											{expandedRows[alert._id] ? "Hide Evidence" : "View Evidence"}
										</button>
										{!isResolvedTab && alert.status === "OPEN" && (
											<button 
												onClick={() => onAcknowledge(alert._id)}
												className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-semibold text-slate-700 transition hover:bg-slate-50 shadow-sm"
											>
												Ack
											</button>
										)}
										{!isResolvedTab && (
											<button 
												onClick={() => onResolve(alert._id)}
												className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-[11px] font-semibold text-emerald-800 transition hover:bg-emerald-100 shadow-sm"
											>
												Resolve
											</button>
										)}
									</td>
								</tr>
								{expandedRows[alert._id] && (
									<tr className="bg-slate-50/50 border-b border-slate-100">
										<td colSpan={isResolvedTab ? 5 : 6} className="p-0">
											<div className="px-5 pb-5 pt-3">
												<div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
													<div className="font-semibold text-[11px] uppercase tracking-wider text-slate-500 mb-3">Performance Evidence Log</div>
													{alert.performance_window && alert.performance_window.length > 0 ? (
														<div className="overflow-x-auto">
															<table className="w-full text-left font-mono text-[12px] text-slate-600 min-w-[500px]">
															<thead className="border-b border-slate-100 text-slate-400">
																<tr>
																	<th className="pb-2 font-medium">Date</th>
																	<th className="pb-2 text-right font-medium">Predicted</th>
																	<th className="pb-2 text-right font-medium">Actual</th>
																	<th className="pb-2 text-right font-medium">Diff</th>
																	<th className="pb-2 text-right font-medium">Perf %</th>
																</tr>
															</thead>
															<tbody className="divide-y divide-slate-50">
																{alert.performance_window.map((ev, i) => (
																	<tr key={i}>
																		<td className="py-2.5">{ev.date}</td>
																		<td className="py-2.5 text-right">{ev.predicted_kwh?.toFixed(2)}</td>
																		<td className="py-2.5 text-right">{ev.actual_kwh?.toFixed(2)}</td>
																		<td className="py-2.5 text-right text-rose-500">{ev.difference_kwh?.toFixed(2)}</td>
																		<td className="py-2.5 text-right font-semibold text-slate-700">{ev.performance_percent === null ? "N/A" : `${ev.performance_percent?.toFixed(1)}%`}</td>
																	</tr>
																))}
															</tbody>
														</table>
														</div>
													) : (
														<div className="text-slate-400 text-sm italic">No evidence recorded for this incident.</div>
													)}
												</div>
											</div>
										</td>
									</tr>
								)}
							</React.Fragment>
						))}
					</tbody>
				</table>
			</div>
		</section>
	);
};

const SearchableDropdown = ({ options, value, onChange, placeholder, disabled }) => {
	const [isOpen, setIsOpen] = useState(false);
	const [search, setSearch] = useState("");
	const wrapperRef = React.useRef(null);

	useEffect(() => {
		const handleClickOutside = (event) => {
			if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
				setIsOpen(false);
			}
		};
		document.addEventListener("mousedown", handleClickOutside);
		return () => document.removeEventListener("mousedown", handleClickOutside);
	}, []);

	const filteredOptions = options.filter(opt => opt.toLowerCase().includes(search.toLowerCase()));

	return (
		<div className="relative w-full" ref={wrapperRef}>
			<div 
				className={`w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 outline-none flex justify-between items-center ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer focus-within:border-emerald-400 focus-within:ring-2 focus-within:ring-emerald-100 transition-all"}`}
				onClick={() => { if (!disabled) setIsOpen(!isOpen); }}
			>
				<span className={value ? "text-slate-700 font-semibold" : "text-slate-400"}>{value || placeholder}</span>
				<svg className={`w-4 h-4 text-slate-400 transition-transform ${isOpen ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
			</div>

			{isOpen && (
				<div className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-xl shadow-lg max-h-60 flex flex-col overflow-hidden animate-fade-in">
					<div className="bg-slate-50 p-2 border-b border-slate-100 flex-shrink-0">
						<input 
							type="text" 
							className="w-full rounded-lg bg-white border border-slate-200 px-3 py-2 text-sm outline-none focus:border-emerald-400 transition-colors shadow-sm"
							placeholder="Type to search..."
							value={search}
							onChange={e => setSearch(e.target.value)}
							onClick={e => e.stopPropagation()}
							autoFocus
						/>
					</div>
					<div className="overflow-y-auto flex-1">
						{filteredOptions.length > 0 ? (
							<ul className="py-1">
								{filteredOptions.map((opt, i) => (
									<li 
										key={i} 
										className={`px-4 py-2.5 text-sm cursor-pointer transition-colors ${opt === value ? "bg-emerald-50 text-emerald-800 font-semibold" : "text-slate-700 hover:bg-slate-50 hover:text-slate-900 font-medium"}`}
										onClick={() => {
											onChange(opt);
											setIsOpen(false);
											setSearch("");
										}}
									>
										{opt}
									</li>
								))}
							</ul>
						) : (
							<div className="px-4 py-6 text-sm text-slate-400 text-center font-medium">No matching sites found in fleet.</div>
						)}
					</div>
				</div>
			)}
		</div>
	);
};

const AlertReportsView = () => {
	const [siteName, setSiteName] = useState("");
	const [startDate, setStartDate] = useState("");
	const [endDate, setEndDate] = useState("");
	
	const [reportData, setReportData] = useState(null);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState("");
	
	const [validSites, setValidSites] = useState([]);
	const [sitesLoading, setSitesLoading] = useState(true);

	useEffect(() => {
		const loadSites = async () => {
			try {
				const sites = await fetchSOICSites();
				setValidSites(sites || []);
			} catch (err) {
				console.error("Failed to fetch valid sites", err);
			} finally {
				setSitesLoading(false);
			}
		};
		loadSites();
	}, []);

	const handleSearch = async (e) => {
		e.preventDefault();
		if (!siteName.trim()) return;
		
		setLoading(true);
		setError("");
		setReportData(null);
		
		try {
			const res = await fetchSOICSiteHistory(siteName, startDate, endDate);
			setReportData(res);
		} catch (err) {
			setError(err.message || "Failed to load report");
		} finally {
			setLoading(false);
		}
	};

	const generateDownloadLink = (type) => {
		const params = new URLSearchParams({ siteName });
		if (startDate) params.append("startDate", startDate);
		if (endDate) params.append("endDate", endDate);
		return `${API_BASE_URL}/soic/alerts/history/report/${type}?${params.toString()}`;
	};

	return (
		<div className="space-y-6">
			{/* Search Bar */}
			<div className="rounded-2xl border border-slate-200/80 bg-white/88 p-5 shadow-sm">
				<form onSubmit={handleSearch} className="flex flex-col md:flex-row items-end gap-4">
					<div className="flex-1 w-full relative">
						<label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Select Site</label>
						<SearchableDropdown 
							options={validSites} 
							value={siteName} 
							onChange={setSiteName} 
							placeholder={sitesLoading ? "Loading fleet..." : "Search for a valid site..."}
							disabled={sitesLoading}
						/>
					</div>
					<div className="w-full md:w-auto">
						<label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Start Date</label>
						<input 
							type="date" 
							className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700 outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 transition-all"
							value={startDate}
							onChange={e => setStartDate(e.target.value)}
						/>
					</div>
					<div className="w-full md:w-auto">
						<label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">End Date</label>
						<input 
							type="date" 
							className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700 outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 transition-all"
							value={endDate}
							onChange={e => setEndDate(e.target.value)}
						/>
					</div>
					<button 
						type="submit" 
						disabled={loading || !siteName}
						className="w-full md:w-auto rounded-xl bg-gradient-to-r from-emerald-600 to-blue-600 px-6 py-2.5 text-sm font-semibold text-white shadow transition hover:-translate-y-0.5 hover:shadow-lg disabled:opacity-50"
					>
						{loading ? "Searching..." : "Search History"}
					</button>
				</form>
				{error && (
					<div className="mt-5 p-4 rounded-xl bg-rose-50 border border-rose-200/60 flex items-start gap-3 text-rose-800">
						<svg className="w-5 h-5 flex-shrink-0 mt-0.5 text-rose-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
						<div>
							<h3 className="text-sm font-bold">Search Failed</h3>
							<p className="mt-1 text-sm">{error}</p>
						</div>
					</div>
				)}
			</div>

			{/* Report Data Display */}
			{reportData && (
				<div className="space-y-6 animate-fade-in">
					{/* Profile Context Header */}
					<div>
						<h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">{siteName}</h1>
						<p className="text-sm font-semibold text-slate-500 uppercase tracking-wide mt-1">Incident History Report {startDate && endDate ? `(${startDate} to ${endDate})` : ""}</p>
					</div>

					{/* Controls */}
					<div className="mb-4 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-2 lg:gap-3 max-w-xl">
						<a href={generateDownloadLink("excel")} className="w-full text-center rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 px-4 py-2 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:shadow-lg" download>
							Download Excel
						</a>
						<a href={generateDownloadLink("pdf")} className="w-full text-center rounded-xl bg-gradient-to-r from-rose-500 to-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:shadow-lg" download>
							Download PDF
						</a>
					</div>

					{/* Current Active Incidents Section */}
					<div className="rounded-2xl border border-slate-200/80 bg-white shadow-lg overflow-hidden mt-8 mb-8">
						<div className="bg-slate-50/80 border-b border-slate-200/70 px-5 py-4">
							<h2 className="text-sm font-bold uppercase tracking-wider text-slate-800">Current Active Incidents</h2>
							<p className="text-[13px] text-slate-500 mt-0.5">Real-time open and acknowledged incidents currently affecting this site.</p>
						</div>
						{reportData.active_incidents && reportData.active_incidents.length > 0 ? (
							<div className="overflow-x-auto">
								<table className="w-full text-left text-sm text-slate-700 min-w-[500px]">
									<thead className="bg-slate-50/40 border-b border-slate-100 text-[11px] uppercase tracking-wider font-semibold text-slate-500">
										<tr>
											<th className="px-5 py-3">Severity</th>
											<th className="px-5 py-3">Status</th>
											<th className="px-5 py-3 text-right">Days Active</th>
											<th className="px-5 py-3 text-right">Current Perf %</th>
										</tr>
									</thead>
									<tbody className="divide-y divide-slate-100">
										{reportData.active_incidents.map((inc) => (
											<tr key={inc._id} className="hover:bg-slate-50/50 transition-colors">
												<td className="px-5 py-3"><SeverityBadge severity={inc.severity} /></td>
												<td className="px-5 py-3 font-semibold text-xs text-slate-600">{inc.status}</td>
												<td className="px-5 py-3 text-right font-mono text-[13px] font-semibold text-slate-900">{inc.consecutive_days || inc.total_days_active || 0}</td>
												<td className="px-5 py-3 text-right font-mono text-[13px] text-slate-600">{inc.performance_percent === null ? "N/A" : `${inc.performance_percent?.toFixed(1)}%`}</td>
											</tr>
										))}
									</tbody>
								</table>
							</div>
						) : (
							<div className="px-5 py-8 text-center bg-white">
								<p className="text-sm font-medium text-emerald-600 flex items-center justify-center gap-2">
									<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
									No active incidents. Site is currently healthy.
								</p>
							</div>
						)}
					</div>

					{/* Historical Summary Header */}
					<div className="pt-4 border-t border-slate-200/80">
						<h2 className="text-sm font-bold uppercase tracking-wider text-slate-800 mb-1">Historical Summary</h2>
						<p className="text-[13px] text-slate-500 mb-4">Immutable log of fully resolved and historical incidents.</p>
					</div>

					{/* Summary Grid */}
					<div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
						<div className="rounded-2xl border border-slate-200/80 bg-white/88 p-4 shadow-sm">
							<p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Total Historical</p>
							<p className="mt-2 text-2xl font-bold text-slate-900">{reportData.metrics.historical.TotalAlerts}</p>
							<p className="mt-1 text-xs text-slate-500">Incidents on record</p>
						</div>
						<div className="rounded-2xl border border-slate-200/80 bg-white/88 p-4 shadow-sm">
							<p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Resolved</p>
							<p className="mt-2 text-2xl font-bold text-emerald-600">{reportData.metrics.historical.Resolved}</p>
							<p className="mt-1 text-xs text-slate-500">Successfully closed</p>
						</div>
						<div className="rounded-2xl border border-slate-200/80 bg-white/88 p-4 shadow-sm">
							<p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Avg Resolution</p>
							<p className="mt-2 text-2xl font-bold text-slate-900">{reportData.metrics.historical.AverageResolutionTime} d</p>
							<p className="mt-1 text-xs text-slate-500">Mean time to resolve</p>
						</div>
						<div className="rounded-2xl border border-slate-200/80 bg-white/88 p-4 shadow-sm">
							<p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Longest Incident</p>
							<p className="mt-2 text-2xl font-bold text-rose-600">{reportData.metrics.historical.LongestIncident} d</p>
							<p className="mt-1 text-xs text-rose-700">Max continuous days</p>
						</div>
					</div>

					{/* Severity Breakdown */}
					<div className="rounded-2xl border border-slate-200/80 bg-white/88 p-5 shadow-sm">
						<p className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-4">Severity Breakdown (Historical)</p>
						<div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-sm">
							<div className="rounded-xl bg-yellow-50/50 border border-yellow-100 p-3">
								<p className="font-semibold text-yellow-800">Yellow</p>
								<p className="mt-1 text-slate-700 font-medium">{reportData.metrics.historical.SeverityBreakdown.YELLOW.count} <span className="text-slate-500 text-xs">({reportData.metrics.historical.SeverityBreakdown.YELLOW.percent}%)</span></p>
							</div>
							<div className="rounded-xl bg-orange-50/50 border border-orange-100 p-3">
								<p className="font-semibold text-orange-800">Orange</p>
								<p className="mt-1 text-slate-700 font-medium">{reportData.metrics.historical.SeverityBreakdown.ORANGE.count} <span className="text-slate-500 text-xs">({reportData.metrics.historical.SeverityBreakdown.ORANGE.percent}%)</span></p>
							</div>
							<div className="rounded-xl bg-red-50/50 border border-red-100 p-3">
								<p className="font-semibold text-red-800">Red</p>
								<p className="mt-1 text-slate-700 font-medium">{reportData.metrics.historical.SeverityBreakdown.RED.count} <span className="text-slate-500 text-xs">({reportData.metrics.historical.SeverityBreakdown.RED.percent}%)</span></p>
							</div>
							<div className="rounded-xl bg-rose-50/50 border border-rose-100 p-3">
								<p className="font-semibold text-rose-800">Critical</p>
								<p className="mt-1 text-slate-700 font-medium">{reportData.metrics.historical.SeverityBreakdown.CRITICAL.count} <span className="text-slate-500 text-xs">({reportData.metrics.historical.SeverityBreakdown.CRITICAL.percent}%)</span></p>
							</div>
							<div className="rounded-xl bg-slate-50/50 border border-slate-200/60 p-3">
								<p className="font-semibold text-slate-800">Offline</p>
								<p className="mt-1 text-slate-700 font-medium">{reportData.metrics.historical.SeverityBreakdown.OFFLINE.count} <span className="text-slate-500 text-xs">({reportData.metrics.historical.SeverityBreakdown.OFFLINE.percent}%)</span></p>
							</div>
						</div>
					</div>

					{/* History Tables */}
					<div className="mt-6">
						<AlertsTable alerts={reportData.history} isResolvedTab={true} />
					</div>
				</div>
			)}
		</div>
	);
};

const LoadingSkeleton = () => (
	<div className="animate-pulse flex flex-col items-center justify-center p-12 bg-white/60 border border-slate-200/80 rounded-2xl shadow-sm">
		<div className="h-4 bg-slate-200 rounded-full w-48 mb-4"></div>
		<div className="h-3 bg-slate-100 rounded-full w-64"></div>
	</div>
);

const SidebarTab = ({ id, label, count, activeTab, onClick, isReport = false }) => {
	const isActive = activeTab === id;
	
	let activeStyles = "border border-transparent bg-transparent text-slate-600 hover:bg-slate-50";
	let countStyles = "bg-slate-100 text-slate-500";
	
	if (isActive) {
		if (isReport) {
			activeStyles = "border border-blue-200 bg-blue-50 text-blue-800 shadow-sm";
			countStyles = "bg-blue-100";
		} else {
			activeStyles = "border border-emerald-200 bg-emerald-50 text-emerald-800 shadow-sm";
			countStyles = "bg-emerald-100/80 text-emerald-800";
		}
	}

	return (
		<button
			onClick={() => onClick(id)}
			className={`w-full flex items-center justify-between rounded-xl px-4 py-3 text-left text-sm font-semibold transition ${activeStyles}`}
		>
			<span>{label}</span>
			{count !== undefined && (
				<span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${countStyles}`}>
					{count}
				</span>
			)}
		</button>
	);
};

const SOICDashboard = () => {
	const navigate = useNavigate();
	const [metrics, setMetrics] = useState(EMPTY_METRICS);
	const [activeAlerts, setActiveAlerts] = useState([]);
	const [criticalSites, setCriticalSites] = useState([]);
	const [offlineSites, setOfflineSites] = useState([]);
	const [activeSites, setActiveSites] = useState([]);
	const [resolvedAlerts, setResolvedAlerts] = useState([]);
	
	const [activeTab, setActiveTab] = useState("active_alerts");
	const [loading, setLoading] = useState(true);
	const [resolvedLoading, setResolvedLoading] = useState(false);
	const [error, setError] = useState("");

	const loadDashboard = useCallback(async () => {
		setLoading(true);
		setError("");
		try {
			const dashboard = await fetchSOICDashboard();
			if (dashboard) {
				setMetrics(dashboard.metrics || EMPTY_METRICS);
				setActiveAlerts(dashboard.active_alerts || []);
				setCriticalSites(dashboard.critical_sites || []);
				setOfflineSites(dashboard.offline_sites || []);
				setActiveSites(dashboard.active_sites || []);
			}
		} catch (err) {
			setError(err.message || "Failed to load dashboard");
		} finally {
			setLoading(false);
		}
	}, []);

	const loadResolved = useCallback(async () => {
		setResolvedLoading(true);
		try {
			const resolved = await fetchSOICResolvedAlerts();
			setResolvedAlerts(resolved || []);
		} catch (err) {
			console.error("Failed to fetch resolved alerts", err);
		} finally {
			setResolvedLoading(false);
		}
	}, []);

	useEffect(() => {
		loadDashboard();
	}, [loadDashboard]);

	useEffect(() => {
		if (activeTab === "resolved_alerts" && resolvedAlerts.length === 0) {
			loadResolved();
		}
	}, [activeTab, resolvedAlerts.length, loadResolved]);

	const handleAcknowledge = async (id) => {
		try {
			await acknowledgeSOICAlert(id);
			await loadDashboard();
		} catch (err) {
			alert(err.message || "Failed to acknowledge");
		}
	};

	const handleResolve = async (id) => {
		try {
			const notes = window.prompt("Resolution Notes (Optional):");
			if (notes !== null) {
				await resolveSOICAlert(id, { notes });
				await loadDashboard();
				if (activeTab === "resolved_alerts") {
					await loadResolved();
				}
			}
		} catch (err) {
			alert(err.message || "Failed to resolve");
		}
	};

	return (
		<div className="min-h-screen bg-[radial-gradient(circle_at_12%_16%,#d7f8e7_0,transparent_42%),radial-gradient(circle_at_88%_20%,#d8e9ff_0,transparent_44%),linear-gradient(135deg,#eff4fb_0%,#edf8ff_100%)] text-slate-900 font-sans">
			
			{/* SOIC Specific Sidebar Navigation */}
			<aside className="fixed inset-y-0 left-0 z-40 hidden w-72 border-r border-slate-200/80 bg-white/88 px-5 pb-6 pt-8 shadow-lg backdrop-blur-md lg:flex lg:flex-col">
				<div className="mb-8 flex items-center gap-3">
					<div className="px-3">
						<p className="text-lg font-black leading-none text-slate-900">Operations Console</p>
						<p className="mt-1 text-[10px] uppercase tracking-[0.2em] text-slate-500">Intelligence Center</p>
					</div>
				</div>

				<nav className="space-y-2 flex-1">
					<div className="mb-4">
						<p className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-wider text-slate-400">Live Monitor</p>
						<div className="space-y-1.5">
							<SidebarTab id="active_alerts" label="Active Alerts" count={activeAlerts.length} activeTab={activeTab} onClick={setActiveTab} />
							<SidebarTab id="critical_sites" label="Critical Sites" count={criticalSites.length} activeTab={activeTab} onClick={setActiveTab} />
							<SidebarTab id="offline_sites" label="Offline Sites" count={offlineSites.length} activeTab={activeTab} onClick={setActiveTab} />
							<SidebarTab id="active_sites" label="Active Sites" count={activeSites.length} activeTab={activeTab} onClick={setActiveTab} />
						</div>
					</div>

					<div className="mt-8">
						<p className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-wider text-slate-400">Investigations</p>
						<div className="space-y-1.5">
							<SidebarTab id="resolved_alerts" label="Resolved Alerts" activeTab={activeTab} onClick={setActiveTab} />
							<SidebarTab id="alert_reports" label="Alert Reports" activeTab={activeTab} onClick={setActiveTab} isReport={true} />
						</div>
					</div>
				</nav>

				<div className="mt-auto space-y-3 pt-6 border-t border-slate-200/60">
					<button
						type="button"
						className="w-full rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow transition hover:-translate-y-0.5 hover:shadow-lg"
						onClick={() => navigate("/")}
					>
						Exit to SolarWizer
					</button>
				</div>
			</aside>

			{/* Top Header */}
			<header className="sticky top-0 z-30 border-b border-slate-200/70 bg-white/80 px-3 py-3 backdrop-blur-xl sm:px-4 lg:pl-[19.5rem] lg:pr-8">
				<div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
					<div>
						<div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500 sm:text-xs">Dashboard Console</div>
						<p className="text-sm font-bold text-slate-800 lg:hidden">Operations</p>
					</div>
					{activeTab !== "alert_reports" && (
						<div className="flex items-center justify-end">
							<button 
								onClick={loadDashboard}
								disabled={loading}
								className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 shadow-sm hover:-translate-y-0.5 hover:shadow-md disabled:opacity-50"
							>
								{loading ? "Refreshing..." : "Refresh Data"}
							</button>
						</div>
					)}
				</div>
			</header>

			{/* Mobile Navigation Tabs */}
			<div className="lg:hidden sticky top-[60px] z-20 border-b border-slate-200/70 bg-white/90 px-3 py-3 backdrop-blur-xl overflow-x-auto">
				<div className="flex gap-2 min-w-max">
					<button 
						onClick={() => setActiveTab("active_alerts")}
						className={`px-4 py-2 rounded-full text-sm font-semibold transition ${activeTab === "active_alerts" ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
					>
						Active Alerts
					</button>
					<button 
						onClick={() => setActiveTab("critical_sites")}
						className={`px-4 py-2 rounded-full text-sm font-semibold transition ${activeTab === "critical_sites" ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
					>
						Critical Sites
					</button>
					<button 
						onClick={() => setActiveTab("offline_sites")}
						className={`px-4 py-2 rounded-full text-sm font-semibold transition ${activeTab === "offline_sites" ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
					>
						Offline Sites
					</button>
					<button 
						onClick={() => setActiveTab("active_sites")}
						className={`px-4 py-2 rounded-full text-sm font-semibold transition ${activeTab === "active_sites" ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
					>
						Active Sites
					</button>
					<button 
						onClick={() => setActiveTab("resolved_alerts")}
						className={`px-4 py-2 rounded-full text-sm font-semibold transition ${activeTab === "resolved_alerts" ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
					>
						Resolved
					</button>
					<button 
						onClick={() => setActiveTab("alert_reports")}
						className={`px-4 py-2 rounded-full text-sm font-semibold transition ${activeTab === "alert_reports" ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
					>
						Reports
					</button>
				</div>
			</div>

			{/* Main Content Area pushed right for the new 72 w sidebar (18rem) -> pl-[19.5rem] */}
			<main className="px-3 py-5 sm:px-4 sm:py-6 lg:pl-[19.5rem] lg:pr-8">
				<div className="mx-auto max-w-7xl space-y-6">
					
					{/* Hero Section */}
					<section className="space-y-2">
						<div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
							<div>
								<h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl md:text-4xl">
									{activeTab === "active_alerts" && "Active Alerts"}
									{activeTab === "active_sites" && "Healthy Fleet"}
									{activeTab === "critical_sites" && "Critical Action Required"}
									{activeTab === "offline_sites" && "Offline Systems"}
									{activeTab === "resolved_alerts" && "Resolution Pipeline"}
									{activeTab === "alert_reports" && "Incident History Reporting"}
								</h1>
								<p className="max-w-3xl text-sm text-slate-600 sm:text-base mt-2">
									{activeTab === "active_alerts" && "Review and acknowledge open incidents escalating across the fleet."}
									{activeTab === "active_sites" && "Monitor systems operating within normal performance thresholds."}
									{activeTab === "critical_sites" && "Immediate action required for systems underperforming for over 7 days."}
									{activeTab === "offline_sites" && "Systems that have lost connection and stopped transmitting telemetry data."}
									{activeTab === "resolved_alerts" && "Historical log of fully resolved and documented incidents."}
									{activeTab === "alert_reports" && "Generate and export detailed incident history reports by site."}
								</p>
							</div>
						</div>
					</section>

					{error && (
						<div className="bg-rose-50 border border-rose-200/60 text-rose-800 px-4 py-3 rounded-xl text-sm font-medium shadow-sm">
							{error}
						</div>
					)}

					{activeTab !== "alert_reports" && (
						<section className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
							<div className="rounded-2xl border border-slate-200/80 bg-white/88 p-4 shadow-sm">
								<p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Total Sites</p>
								<p className="mt-2 text-2xl font-bold text-slate-900">{metrics.total_sites}</p>
								<p className="mt-1 text-[11px] text-slate-500">Monitored systems</p>
							</div>
							<div className="rounded-2xl border border-slate-200/80 bg-white/88 p-4 shadow-sm">
								<p className="text-xs font-semibold uppercase tracking-wider text-emerald-600">Connected</p>
								<p className="mt-2 text-2xl font-bold text-emerald-700">{metrics.connected_sites}</p>
								<p className="mt-1 text-[11px] text-emerald-600/80">Transmitting data</p>
							</div>
							<div className="rounded-2xl border border-emerald-200/80 bg-emerald-50/50 p-4 shadow-sm">
								<p className="text-xs font-semibold uppercase tracking-wider text-emerald-700">Active Sites</p>
								<p className="mt-2 text-2xl font-bold text-emerald-800">{metrics.active_sites}</p>
								<p className="mt-1 text-[11px] text-emerald-700/80">Operating normally</p>
							</div>
							<div className="rounded-2xl border border-slate-200/80 bg-white/88 p-4 shadow-sm">
								<p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Offline</p>
								<p className="mt-2 text-2xl font-bold text-slate-700">{metrics.offline_sites}</p>
								<p className="mt-1 text-[11px] text-slate-500">Connection lost</p>
							</div>
							<div className="rounded-2xl border border-orange-200/80 bg-orange-50/50 p-4 shadow-sm">
								<p className="text-xs font-semibold uppercase tracking-wider text-orange-700">Active Alerts</p>
								<p className="mt-2 text-2xl font-bold text-orange-700">{metrics.active_alerts}</p>
								<p className="mt-1 text-[11px] text-orange-700/80">Open incidents</p>
							</div>
							<div className="rounded-2xl border border-rose-200/80 bg-rose-50/50 p-4 shadow-sm">
								<p className="text-xs font-semibold uppercase tracking-wider text-rose-700">Critical Sites</p>
								<p className="mt-2 text-2xl font-bold text-rose-700">{metrics.critical_sites}</p>
								<p className="mt-1 text-[11px] text-rose-700/80">Requires attention</p>
							</div>
						</section>
					)}

					{/* Tab Content */}
					<div className="pt-2">
						{loading && activeTab !== "resolved_alerts" && activeTab !== "alert_reports" ? (
							<LoadingSkeleton />
						) : (
							<>
								{activeTab === "active_alerts" && (
									<AlertsTable alerts={activeAlerts} onAcknowledge={handleAcknowledge} onResolve={handleResolve} />
								)}
								{activeTab === "active_sites" && (
									<ActiveSitesTable sites={activeSites} />
								)}
								{activeTab === "critical_sites" && (
									<AlertsTable alerts={criticalSites} onAcknowledge={handleAcknowledge} onResolve={handleResolve} />
								)}
								{activeTab === "offline_sites" && (
									<AlertsTable alerts={offlineSites} onAcknowledge={handleAcknowledge} onResolve={handleResolve} />
								)}
								{activeTab === "resolved_alerts" && (
									<>
										{resolvedLoading ? (
											<LoadingSkeleton />
										) : (
											<AlertsTable alerts={resolvedAlerts} isResolvedTab={true} />
										)}
									</>
								)}
								{activeTab === "alert_reports" && <AlertReportsView />}
							</>
						)}
					</div>
				</div>
			</main>
		</div>
	);
};

export default SOICDashboard;
