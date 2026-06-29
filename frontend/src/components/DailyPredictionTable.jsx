const dateFormatter = new Intl.DateTimeFormat("en-IN", {
	day: "2-digit",
	month: "short",
	year: "numeric"
});

const formatDate = (date) => {
	if (!date) return "N/A";

	const parsedDate = new Date(`${date}T00:00:00`);

	if (Number.isNaN(parsedDate.getTime())) {
		return date;
	}

	return dateFormatter.format(parsedDate);
};

const formatNumber = (value, suffix = "") => {
	if (value === null || value === undefined || value === "N/A") {
		return "N/A";
	}

	const numberValue = Number(value);

	if (!Number.isFinite(numberValue)) {
		return "N/A";
	}

	return `${numberValue.toFixed(2)}${suffix}`;
};

const getComparisonBadgeClasses = (comparison) => {
	if (comparison === "greater") {
		return "bg-emerald-100 text-emerald-800";
	}

	if (comparison === "lesser") {
		return "bg-rose-100 text-rose-800";
	}

	if (comparison === "equal") {
		return "bg-blue-100 text-blue-800";
	}

	return "bg-slate-100 text-slate-700";
};

const toComparableNumber = (value) => {
	const numberValue = Number(value);
	return Number.isFinite(numberValue) ? numberValue : null;
};

const DailyPredictionTable = ({ predictions = [], loading = false, error = "", fetching = false, onFetchNow }) => {
	const latestPrediction = predictions[0];
	const totalPredicted = predictions.reduce((sum, prediction) => sum + Number(prediction.predicted_kwh ?? 0), 0);
	const latestActual = toComparableNumber(latestPrediction?.inverter_real_time_kwh);
	const latestPredicted = toComparableNumber(latestPrediction?.predicted_kwh);
	const latestDifference = latestActual !== null && latestPredicted !== null
		? latestActual - latestPredicted
		: null;
	const latestComparison = latestPrediction?.comparison ?? "N/A";

	return (
		<div className="rounded-2xl border border-slate-300/60 bg-white/90 p-5 shadow-lg backdrop-blur-sm">
			<div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
				<div>
					<h3 className="text-2xl font-bold tracking-tight text-slate-900">Daily Prediction History</h3>
					<p className="mt-1 text-sm text-slate-600">Today and previous five fetched records, captured daily at 7 PM</p>
				</div>
				<div className="flex flex-wrap items-center gap-2">
					<button
						type="button"
						onClick={onFetchNow}
						disabled={fetching || loading || !onFetchNow}
						className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-bold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
					>
						{fetching ? "Fetching..." : "Fetch now"}
					</button>
					<span className="inline-flex w-fit rounded-full bg-emerald-100 px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-emerald-800">
						6 days
					</span>
				</div>
			</div>

			{loading && <p className="mt-3 text-sm font-semibold text-blue-700">Loading daily predictions...</p>}
			{error && <p className="mt-3 text-sm font-semibold text-rose-700">{error}</p>}

			{!loading && !error && predictions.length > 0 && (
				<div className="mt-5 grid border-y border-slate-200 py-4 sm:grid-cols-2 xl:grid-cols-6">
					<div className="px-1 py-2 sm:px-3">
						<p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Latest Date</p>
						<p className="mt-1 text-xl font-bold text-slate-900">{formatDate(latestPrediction?.date)}</p>
					</div>
					<div className="px-1 py-2 sm:px-3">
						<p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Latest Predicted</p>
						<p className="mt-1 text-xl font-bold text-emerald-700">{formatNumber(latestPrediction?.predicted_kwh, " kWh")}</p>
					</div>
					<div className="px-1 py-2 sm:px-3">
						<p className="text-xs font-semibold uppercase tracking-wide text-slate-500">6-Day Predicted</p>
						<p className="mt-1 text-xl font-bold text-blue-700">{formatNumber(totalPredicted, " kWh")}</p>
					</div>
					<div className="px-1 py-2 sm:px-3">
						<p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Inverter API</p>
						<p className="mt-1 text-xl font-bold text-slate-900">{formatNumber(latestPrediction?.inverter_real_time_kwh, " kWh")}</p>
					</div>
					<div className="px-1 py-2 sm:px-3">
						<p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Today Difference</p>
						<p className={`mt-1 text-xl font-bold ${latestDifference === null ? "text-slate-700" : latestDifference >= 0 ? "text-emerald-700" : "text-rose-700"}`}>
							{latestDifference === null ? "N/A" : `${latestDifference.toFixed(2)} kWh`}
						</p>
					</div>
					<div className="px-1 py-2 sm:px-3">
						<p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Comparison</p>
						<span className={`mt-1 inline-flex rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wide ${getComparisonBadgeClasses(latestComparison)}`}>
							{latestComparison}
						</span>
					</div>
				</div>
			)}

			{!loading && !error && predictions.length === 0 && (
				<div className="mt-5 border-y border-slate-200 py-8 text-center">
					<p className="text-base font-semibold text-slate-800">No daily prediction records are available yet.</p>
					<p className="mt-1 text-sm text-slate-600">Use Fetch now once, or let the 7 PM scheduler capture today automatically.</p>
				</div>
			)}

			{!loading && !error && predictions.length > 0 && (
				<div className="mt-3 overflow-x-auto">
					<table className="min-w-[760px] w-full border-collapse text-left text-sm text-slate-700">
						<thead>
							<tr>
								<th className="border-b border-slate-200 bg-blue-50/70 px-3 py-3 text-xs font-bold uppercase tracking-wide text-slate-600">Date</th>
								<th className="border-b border-slate-200 bg-blue-50/70 px-3 py-3 text-xs font-bold uppercase tracking-wide text-slate-600">Predicted (kWh)</th>
								<th className="border-b border-slate-200 bg-blue-50/70 px-3 py-3 text-xs font-bold uppercase tracking-wide text-slate-600">Inverter (kWh)</th>
								<th className="border-b border-slate-200 bg-blue-50/70 px-3 py-3 text-xs font-bold uppercase tracking-wide text-slate-600">Difference (kWh)</th>
								<th className="border-b border-slate-200 bg-blue-50/70 px-3 py-3 text-xs font-bold uppercase tracking-wide text-slate-600">Comparison</th>
								<th className="border-b border-slate-200 bg-blue-50/70 px-3 py-3 text-xs font-bold uppercase tracking-wide text-slate-600">Peak Power (kW)</th>
								<th className="border-b border-slate-200 bg-blue-50/70 px-3 py-3 text-xs font-bold uppercase tracking-wide text-slate-600">Temp (C)</th>
								<th className="border-b border-slate-200 bg-blue-50/70 px-3 py-3 text-xs font-bold uppercase tracking-wide text-slate-600">Cloud Cover (%)</th>
							</tr>
						</thead>
						<tbody>
							{predictions.map((prediction) => (
								<tr key={prediction.date} className="hover:bg-slate-50/80">
									<td className="whitespace-nowrap border-b border-slate-100 px-3 py-3 font-semibold text-slate-900">
										{formatDate(prediction.date)}
									</td>
									<td className="whitespace-nowrap border-b border-slate-100 px-3 py-3">
										{formatNumber(prediction.predicted_kwh)}
									</td>
									<td className="whitespace-nowrap border-b border-slate-100 px-3 py-3">
										{formatNumber(prediction.inverter_real_time_kwh)}
									</td>
									<td className="whitespace-nowrap border-b border-slate-100 px-3 py-3">
										{formatNumber(prediction.difference_kwh)}
									</td>
									<td className="whitespace-nowrap border-b border-slate-100 px-3 py-3">
										<span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide ${getComparisonBadgeClasses(prediction.comparison)}`}>
											{prediction.comparison ?? "N/A"}
										</span>
									</td>
									<td className="whitespace-nowrap border-b border-slate-100 px-3 py-3">
										{formatNumber(prediction.peak_power_kw)}
									</td>
									<td className="whitespace-nowrap border-b border-slate-100 px-3 py-3">
										{formatNumber(prediction.avg_temperature)}
									</td>
									<td className="whitespace-nowrap border-b border-slate-100 px-3 py-3">
										{formatNumber(prediction.avg_cloud_cover)}
									</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
			)}
		</div>
	);
};

export default DailyPredictionTable;
