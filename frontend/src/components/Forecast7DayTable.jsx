const Forecast7DayTable = ({ forecast = [] }) => {
	if (!forecast.length) {
		return (
			<div className="rounded-2xl border border-slate-300/60 bg-white/90 p-4 shadow-lg backdrop-blur-sm">
				<div>
					<h3 className="text-xl font-bold tracking-tight text-slate-900">7-Day Prediction</h3>
				</div>
				<p className="mt-3 text-sm font-medium text-slate-600">No forecast data available.</p>
			</div>
		);
	}

	return (
		<div className="rounded-2xl border border-slate-300/60 bg-white/90 p-4 shadow-lg backdrop-blur-sm">
			<div>
				<h3 className="text-xl font-bold tracking-tight text-slate-900">7-Day Prediction</h3>
				<p className="mt-1 text-sm text-slate-600">Daily output, cloud cover, and temperature</p>
			</div>
			<div className="mt-3 overflow-x-auto">
				<table className="min-w-[620px] w-full border-collapse text-left text-sm text-slate-700">
					<thead>
						<tr>
							<th className="border-b border-slate-200 bg-blue-50/70 px-3 py-3 text-xs font-bold uppercase tracking-wide text-slate-600">Date</th>
							<th className="border-b border-slate-200 bg-blue-50/70 px-3 py-3 text-xs font-bold uppercase tracking-wide text-slate-600">Predicted (kWh)</th>
							<th className="border-b border-slate-200 bg-blue-50/70 px-3 py-3 text-xs font-bold uppercase tracking-wide text-slate-600">Cloud Cover (%)</th>
							<th className="border-b border-slate-200 bg-blue-50/70 px-3 py-3 text-xs font-bold uppercase tracking-wide text-slate-600">Temperature (deg C)</th>
						</tr>
					</thead>
					<tbody>
						{forecast.map((item) => (
							<tr key={item.date} className="hover:bg-slate-50/80">
								<td className="border-b border-slate-100 px-3 py-3 whitespace-nowrap">{item.date}</td>
								<td className="border-b border-slate-100 px-3 py-3 whitespace-nowrap">{Number(item.predicted_kwh ?? 0).toFixed(2)}</td>
								<td className="border-b border-slate-100 px-3 py-3 whitespace-nowrap">{item.cloud_cover}</td>
								<td className="border-b border-slate-100 px-3 py-3 whitespace-nowrap">{item.temperature}</td>
							</tr>
						))}
					</tbody>
				</table>
			</div>
		</div>
	);
};

export default Forecast7DayTable;
