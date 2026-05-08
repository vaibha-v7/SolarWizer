const StatsStrip = ({ report, source }) => {
	if (!report) return null;

	return (
		<div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
			<div className="rounded-xl border border-slate-300/60 bg-white px-4 py-3 shadow-sm">
				<p className="text-xs font-medium text-slate-500">Annual Energy</p>
				<strong className="mt-2 block text-xl font-bold text-slate-900">{report.annual_energy_kwh?.toFixed?.(2) ?? report.annual_energy_kwh} kWh</strong>
			</div>
			<div className="rounded-xl border border-slate-300/60 bg-white px-4 py-3 shadow-sm">
				<p className="text-xs font-medium text-slate-500">Model Source</p>
				<strong className="mt-2 block text-xl font-bold text-slate-900">{source?.toUpperCase() ?? report.source ?? "N/A"}</strong>
			</div>
			<div className="rounded-xl border border-slate-300/60 bg-white px-4 py-3 shadow-sm">
				<p className="text-xs font-medium text-slate-500">DC/AC Ratio</p>
				<strong className="mt-2 block text-xl font-bold text-slate-900">{report.dc_ac_ratio?.toFixed?.(2) ?? report.dc_ac_ratio ?? "—"}</strong>
			</div>
			<div className="rounded-xl border border-slate-300/60 bg-white px-4 py-3 shadow-sm">
				<p className="text-xs font-medium text-slate-500">Inverter Efficiency</p>
				<strong className="mt-2 block text-xl font-bold text-slate-900">{report.inv_efficiency ?? "—"}%</strong>
			</div>
			<div className="rounded-xl border border-slate-300/60 bg-white px-4 py-3 shadow-sm">
				<p className="text-xs font-medium text-slate-500">Bifaciality</p>
				<strong className="mt-2 block text-xl font-bold text-slate-900">{report.bifaciality?.toFixed?.(2) ?? report.bifaciality ?? "—"}</strong>
			</div>
		</div>
	);
};

export default StatsStrip;
