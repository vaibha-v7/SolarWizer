import { useMemo, useState } from "react";

const MONTH_ORDER = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const MonthlyLineChartWithTable = ({ monthlyData = {} }) => {
	const values = MONTH_ORDER.map((month) => Number(monthlyData[month] ?? 0));
	const maxValue = Math.max(...values, 1);
	const [hoveredIndex, setHoveredIndex] = useState(null);
	const [viewMode, setViewMode] = useState("chart");

	const width = 760;
	const height = 280;
	const padding = 32;

	const chartPoints = useMemo(
		() => values.map((value, index) => {
			const x = padding + (index * (width - padding * 2)) / (MONTH_ORDER.length - 1);
			const y = height - padding - (value / maxValue) * (height - padding * 2);
			return { month: MONTH_ORDER[index], value, x, y };
		}),
		[values, maxValue]
	);

	const tableData = useMemo(() => {
		const total = values.reduce((sum, val) => sum + val, 0);
		const avg = total / 12;
		const max = Math.max(...values);
		const min = Math.min(...values.filter(v => v > 0), maxValue);

		return {
			months: chartPoints,
			total,
			avg,
			max,
			min,
			q1: chartPoints.slice(0, 3).reduce((sum, p) => sum + p.value, 0) / 3,
			q2: chartPoints.slice(3, 6).reduce((sum, p) => sum + p.value, 0) / 3,
			q3: chartPoints.slice(6, 9).reduce((sum, p) => sum + p.value, 0) / 3,
			q4: chartPoints.slice(9, 12).reduce((sum, p) => sum + p.value, 0) / 3
		};
	}, [chartPoints, maxValue, values]);

	const points = chartPoints.map((point) => `${point.x},${point.y}`).join(" ");
	const hoveredPoint = hoveredIndex !== null ? chartPoints[hoveredIndex] : null;
	const tooltipX = hoveredPoint
		? Math.min(Math.max(hoveredPoint.x - 58, 10), width - 126)
		: 0;

	return (
		<div className="rounded-2xl border border-slate-300/60 bg-white/90 p-4 shadow-lg backdrop-blur-sm">
			<div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
				<div>
					<h3 className="text-xl font-bold tracking-tight text-slate-900">Monthly Solar Generation</h3>
					<p className="mt-1 text-sm text-slate-600">kWh trend from Jan to Dec</p>
				</div>
				<div className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-100 p-1">
					<button
						onClick={() => setViewMode("chart")}
						className={`px-3 py-1.5 text-xs font-semibold rounded transition-all ${
							viewMode === "chart"
								? "bg-blue-500 text-white shadow-md"
								: "text-slate-600 hover:text-slate-900"
						}`}
					>
						Chart
					</button>
					<button
						onClick={() => setViewMode("table")}
						className={`px-3 py-1.5 text-xs font-semibold rounded transition-all ${
							viewMode === "table"
								? "bg-blue-500 text-white shadow-md"
								: "text-slate-600 hover:text-slate-900"
						}`}
					>
						Table
					</button>
				</div>
			</div>

			{viewMode === "chart" ? (
				<div className="overflow-x-auto">
					<svg
						viewBox={`0 0 ${width} ${height}`}
						className="block h-auto w-[760px] max-w-none sm:w-full sm:max-w-full"
						role="img"
						aria-label="Monthly solar report line chart"
						onMouseLeave={() => setHoveredIndex(null)}
					>
						<defs>
							<linearGradient id="lineGradient" x1="0" x2="1" y1="0" y2="0">
								<stop offset="0%" stopColor="#1f8f5a" />
								<stop offset="100%" stopColor="#2a6adf" />
							</linearGradient>
							<filter id="dotGlow" x="-50%" y="-50%" width="200%" height="200%">
								<feGaussianBlur stdDeviation="2.2" result="coloredBlur" />
								<feMerge>
									<feMergeNode in="coloredBlur" />
									<feMergeNode in="SourceGraphic" />
								</feMerge>
							</filter>
						</defs>

						{[0, 1, 2, 3, 4].map((step) => {
							const y = padding + (step * (height - padding * 2)) / 4;
							const label = Math.round(maxValue - (step * maxValue) / 4);
							return (
								<g key={step}>
									<line x1={padding} y1={y} x2={width - padding} y2={y} stroke="rgba(42,75,112,0.16)" strokeWidth="1" />
									<text x={8} y={y + 4} fill="#38566f" fontSize="11" fontWeight="700">{label}</text>
								</g>
							);
						})}

						<polyline points={points} fill="none" stroke="url(#lineGradient)" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" />

						{hoveredPoint && (
							<g>
								<line
									x1={hoveredPoint.x}
									y1={padding}
									x2={hoveredPoint.x}
									y2={height - padding}
									stroke="rgba(31,143,90,0.45)"
									strokeWidth="1.5"
									strokeDasharray="4 3"
								/>
								<rect x={tooltipX} y={8} width="116" height="48" rx="8" fill="rgba(10,26,38,0.9)" stroke="rgba(255,255,255,0.25)" strokeWidth="1" />
								<text x={tooltipX + 10} y={27} fill="#95dbff" fontSize="11" fontWeight="700">{hoveredPoint.month}</text>
								<text x={tooltipX + 10} y={44} fill="#ffffff" fontSize="12" fontWeight="800">{hoveredPoint.value.toFixed(2)} kWh</text>
							</g>
						)}

						{chartPoints.map((point, index) => {
							const isHovered = hoveredIndex === index;
							return (
								<g key={point.month}>
									<circle
										cx={point.x}
										cy={point.y}
										r={isHovered ? "7" : "4.5"}
										fill={isHovered ? "#1f8f5a" : "#2a6adf"}
										stroke="#ffffff"
										strokeWidth="1.5"
										filter={isHovered ? "url(#dotGlow)" : undefined}
									/>
									<circle
										cx={point.x}
										cy={point.y}
										r="14"
										fill="transparent"
										style={{ cursor: "pointer" }}
										onMouseEnter={() => setHoveredIndex(index)}
									/>
									<text x={point.x} y={height - 12} textAnchor="middle" fill="#38566f" fontSize="11" fontWeight="700">
										{point.month}
									</text>
								</g>
							);
						})}
					</svg>
				</div>
			) : (
				<div className="space-y-4">
					{/* Monthly Data Table */}
					<div className="overflow-x-auto rounded-lg border border-slate-200">
						<table className="w-full text-sm">
							<thead>
								<tr className="bg-blue-50">
									<th className="px-4 py-3 text-left font-semibold text-slate-700">Month</th>
									<th className="px-4 py-3 text-right font-semibold text-slate-700">Energy (kWh)</th>
									<th className="px-4 py-3 text-right font-semibold text-slate-700">% of Annual</th>
								</tr>
							</thead>
							<tbody>
								{tableData.months.map((point, idx) => (
									<tr key={point.month} className={idx % 2 === 0 ? "bg-white" : "bg-slate-50"}>
										<td className="px-4 py-3 font-medium text-slate-900">{point.month}</td>
										<td className="px-4 py-3 text-right text-slate-700">{point.value.toFixed(2)}</td>
										<td className="px-4 py-3 text-right text-slate-600">
											{((point.value / tableData.total) * 100).toFixed(1)}%
										</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>

					{/* Summary Statistics */}
					<div className="grid grid-cols-2 gap-2 sm:grid-cols-4 text-sm">
						<div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
							<p className="text-xs font-semibold text-slate-600 uppercase">Total</p>
							<p className="mt-1 text-lg font-bold text-slate-900">{tableData.total.toFixed(2)}</p>
							<p className="text-xs text-slate-500">kWh/year</p>
						</div>
						<div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
							<p className="text-xs font-semibold text-slate-600 uppercase">Average</p>
							<p className="mt-1 text-lg font-bold text-slate-900">{tableData.avg.toFixed(2)}</p>
							<p className="text-xs text-slate-500">kWh/month</p>
						</div>
						<div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
							<p className="text-xs font-semibold text-slate-600 uppercase">Max</p>
							<p className="mt-1 text-lg font-bold text-emerald-600">{tableData.max.toFixed(2)}</p>
							<p className="text-xs text-slate-500">kWh</p>
						</div>
						<div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
							<p className="text-xs font-semibold text-slate-600 uppercase">Min</p>
							<p className="mt-1 text-lg font-bold text-blue-600">{tableData.min.toFixed(2)}</p>
							<p className="text-xs text-slate-500">kWh</p>
						</div>
					</div>

					{/* Quarterly Average */}
					<div className="rounded-lg border border-slate-200 bg-gradient-to-r from-blue-50 to-emerald-50 p-3">
						<p className="text-xs font-semibold text-slate-600 uppercase mb-2">Quarterly Average</p>
						<div className="grid grid-cols-4 gap-2 text-sm">
							<div>
								<p className="text-xs text-slate-600">Q1 (Jan-Mar)</p>
								<p className="font-bold text-slate-900">{tableData.q1.toFixed(2)} kWh</p>
							</div>
							<div>
								<p className="text-xs text-slate-600">Q2 (Apr-Jun)</p>
								<p className="font-bold text-slate-900">{tableData.q2.toFixed(2)} kWh</p>
							</div>
							<div>
								<p className="text-xs text-slate-600">Q3 (Jul-Sep)</p>
								<p className="font-bold text-slate-900">{tableData.q3.toFixed(2)} kWh</p>
							</div>
							<div>
								<p className="text-xs text-slate-600">Q4 (Oct-Dec)</p>
								<p className="font-bold text-slate-900">{tableData.q4.toFixed(2)} kWh</p>
							</div>
						</div>
					</div>
				</div>
			)}
		</div>
	);
};

export default MonthlyLineChartWithTable;
