const StatsStrip = ({ report }) => {
	if (!report) return null;

	return (
		<div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
			<div className="rounded-xl border border-slate-300/60 bg-white px-4 py-3 shadow-sm">
				<p className="text-xs font-medium text-slate-500">Annual Energy</p>
				<strong className="mt-2 block text-xl font-bold text-slate-900">{report.annual_energy_kwh?.toFixed?.(2) ?? report.annual_energy_kwh} kWh</strong>
			</div>
			<div className="rounded-xl border border-slate-300/60 bg-white px-4 py-3 shadow-sm">
				<p className="text-xs font-medium text-slate-500">Performance Ratio</p>
				<strong className="mt-2 block text-xl font-bold text-slate-900">{report.performance_ratio}</strong>
			</div>
			<div className="rounded-xl border border-slate-300/60 bg-white px-4 py-3 shadow-sm">
				<p className="text-xs font-medium text-slate-500">Forecast Days</p>
				<strong className="mt-2 block text-xl font-bold text-slate-900">{report.forecast_7_days?.length ?? 0}</strong>
			</div>
		</div>
	);
};

export default StatsStrip;
