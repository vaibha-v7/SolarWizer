import { useMemo, useState } from "react";

const MONTH_ORDER = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const MonthlyLineChartWithTable = ({ predictions = {}, actuals = [] }) => {
	const years = useMemo(() => {
		const yrs = Array.from(new Set(actuals.map((a) => a.year)));
		return yrs.length > 0 ? yrs.sort((a, b) => b - a) : [new Date().getFullYear()];
	}, [actuals]);

	const [selectedYear, setSelectedYear] = useState(years[0] || new Date().getFullYear());
	const [hoveredIndex, setHoveredIndex] = useState(null);
	const [viewMode, setViewMode] = useState("chart");

	const filteredActuals = useMemo(() => {
		return actuals.filter((a) => a.year === selectedYear);
	}, [actuals, selectedYear]);

	// Compute max value for scaling the chart (max of predicted and actuals)
	const maxValue = useMemo(() => {
		const predVals = MONTH_ORDER.map((m) => Number(predictions[m] ?? 0));
		const actVals = filteredActuals.map((a) => Number(a.actual_kwh ?? 0));
		return Math.max(...predVals, ...actVals, 10);
	}, [predictions, filteredActuals]);

	const width = 760;
	const height = 280;
	const padding = 32;

	// Calculate chart points
	const predPoints = useMemo(
		() => MONTH_ORDER.map((month, index) => {
			const value = Number(predictions[month] ?? 0);
			const x = padding + (index * (width - padding * 2)) / (MONTH_ORDER.length - 1);
			const y = height - padding - (value / maxValue) * (height - padding * 2);
			return { month, value, x, y };
		}),
		[predictions, maxValue]
	);

	const actPoints = useMemo(
		() => MONTH_ORDER.map((month, index) => {
			const record = filteredActuals.find((a) => a.month === month);
			const value = Number(record?.actual_kwh ?? 0);
			const hasData = record?.hasData ?? false;
			const comparison = record?.comparison ?? "N/A";
			const x = padding + (index * (width - padding * 2)) / (MONTH_ORDER.length - 1);
			const y = height - padding - (value / maxValue) * (height - padding * 2);
			return { month, value, x, y, hasData, comparison };
		}),
		[filteredActuals, maxValue]
	);

	// Slice actuals line to only plot up to the last month with data
	const lastDataIndex = useMemo(() => {
		return MONTH_ORDER.reduce((last, _, idx) => {
			return actPoints[idx].hasData ? idx : last;
		}, -1);
	}, [actPoints]);

	const actLinePoints = useMemo(() => {
		return lastDataIndex >= 0 ? actPoints.slice(0, lastDataIndex + 1) : [];
	}, [actPoints, lastDataIndex]);

	// Table and Stats calculations
	const stats = useMemo(() => {
		const predTotal = MONTH_ORDER.reduce((sum, m) => sum + Number(predictions[m] ?? 0), 0);
		
		const activeActuals = actPoints.filter((p) => p.hasData);
		const actTotal = activeActuals.reduce((sum, p) => sum + p.value, 0);
		const actAvg = activeActuals.length > 0 ? actTotal / activeActuals.length : 0;
		const predAvg = activeActuals.length > 0 
			? activeActuals.reduce((sum, p) => sum + Number(predictions[p.month] ?? 0), 0) / activeActuals.length
			: predTotal / 12;

		const netDiff = actTotal - activeActuals.reduce((sum, p) => sum + Number(predictions[p.month] ?? 0), 0);
		const greaterCount = activeActuals.filter((p) => p.comparison === "greater").length;
		const lesserCount = activeActuals.filter((p) => p.comparison === "lesser").length;

		return {
			predTotal,
			actTotal,
			predAvg,
			actAvg,
			netDiff,
			greaterCount,
			lesserCount,
			monthsTracked: activeActuals.length
		};
	}, [predictions, actPoints]);

	const hoveredPoint = hoveredIndex !== null ? {
		month: MONTH_ORDER[hoveredIndex],
		pred: predPoints[hoveredIndex],
		act: actPoints[hoveredIndex]
	} : null;

	const tooltipX = hoveredPoint
		? Math.min(Math.max(hoveredPoint.pred.x - 70, 10), width - 150)
		: 0;

	return (
		<div className="rounded-2xl border border-slate-300/60 bg-white/90 p-4 shadow-lg backdrop-blur-sm">
			<div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
				<div>
					<h3 className="text-xl font-bold tracking-tight text-slate-900">Monthly Performance Report</h3>
					<p className="mt-1 text-sm text-slate-600">Comparing Predicted vs. Actual Generation</p>
				</div>
				<div className="flex items-center gap-2">
					{years.length > 1 && (
						<select
							value={selectedYear}
							onChange={(e) => setSelectedYear(Number(e.target.value))}
							className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm focus:border-blue-500 focus:outline-none"
						>
							{years.map((y) => (
								<option key={y} value={y}>
									Year {y}
								</option>
							))}
						</select>
					)}
					<div className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-100 p-1">
						<button
							onClick={() => setViewMode("chart")}
							className={`px-3 py-1.5 text-xs font-semibold rounded transition-all ${
								viewMode === "chart"
									? "bg-blue-600 text-white shadow-md"
									: "text-slate-600 hover:text-slate-900"
							}`}
						>
							Chart
						</button>
						<button
							onClick={() => setViewMode("table")}
							className={`px-3 py-1.5 text-xs font-semibold rounded transition-all ${
								viewMode === "table"
									? "bg-blue-600 text-white shadow-md"
									: "text-slate-600 hover:text-slate-900"
							}`}
						>
							Table
						</button>
					</div>
				</div>
			</div>

			{/* Chart Legend */}
			<div className="mb-4 flex items-center justify-center gap-4 text-xs font-semibold">
				<div className="flex items-center gap-1.5">
					<div className="h-0.5 w-6 border-t-2 border-dashed border-slate-400"></div>
					<span className="text-slate-600">Predicted (Model Baseline)</span>
				</div>
				<div className="flex items-center gap-1.5">
					<div className="h-1 w-6 rounded-full bg-emerald-500"></div>
					<span className="text-slate-600">Actual (Inverter Production)</span>
				</div>
			</div>

			{viewMode === "chart" ? (
				<div className="overflow-x-auto">
					<svg
						viewBox={`0 0 ${width} ${height}`}
						className="block h-auto w-[760px] max-w-none sm:w-full sm:max-w-full"
						role="img"
						aria-label="Monthly comparison line chart"
						onMouseLeave={() => setHoveredIndex(null)}
					>
						<defs>
							<linearGradient id="actualLineGradient" x1="0" x2="1" y1="0" y2="0">
								<stop offset="0%" stopColor="#10b981" />
								<stop offset="100%" stopColor="#059669" />
							</linearGradient>
							<filter id="glowEffect" x="-20%" y="-20%" width="140%" height="140%">
								<feGaussianBlur stdDeviation="3" result="blur" />
								<feMerge>
									<feMergeNode in="blur" />
									<feMergeNode in="SourceGraphic" />
								</feMerge>
							</filter>
						</defs>

						{/* Grid Lines */}
						{[0, 1, 2, 3, 4].map((step) => {
							const y = padding + (step * (height - padding * 2)) / 4;
							const label = Math.round(maxValue - (step * maxValue) / 4);
							return (
								<g key={step}>
									<line x1={padding} y1={y} x2={width - padding} y2={y} stroke="rgba(42,75,112,0.1)" strokeWidth="1" />
									<text x={8} y={y + 4} fill="#64748b" fontSize="10" fontWeight="700">{label}</text>
								</g>
							);
						})}

						{/* Predicted Path (Dashed Slate) */}
						<polyline
							points={predPoints.map((p) => `${p.x},${p.y}`).join(" ")}
							fill="none"
							stroke="#94a3b8"
							strokeWidth="2"
							strokeDasharray="4 4"
							strokeLinecap="round"
						/>

						{/* Actual Path (Solid Emerald) */}
						{actLinePoints.length > 0 && (
							<polyline
								points={actLinePoints.map((p) => `${p.x},${p.y}`).join(" ")}
								fill="none"
								stroke="url(#actualLineGradient)"
								strokeWidth="3.5"
								strokeLinecap="round"
								strokeLinejoin="round"
							/>
						)}

						{/* Tooltip Hover Guide Line */}
						{hoveredPoint && (
							<line
								x1={hoveredPoint.pred.x}
								y1={padding}
								x2={hoveredPoint.pred.x}
								y2={height - padding}
								stroke="#cbd5e1"
								strokeWidth="1.5"
								strokeDasharray="3 3"
							/>
						)}

						{/* Interactive Dots & Hover Triggers */}
						{predPoints.map((p, index) => {
							const act = actPoints[index];
							const isHovered = hoveredIndex === index;

							return (
								<g key={p.month}>
									{/* Predicted Dot */}
									<circle
										cx={p.x}
										cy={p.y}
										r={isHovered ? 5.5 : 3.5}
										fill="#94a3b8"
										stroke="#ffffff"
										strokeWidth="1"
									/>

									{/* Actual Dot (only if hasData) */}
									{act.hasData && (
										<circle
											cx={act.x}
											cy={act.y}
											r={isHovered ? 7.5 : 5}
											fill="#10b981"
											stroke="#ffffff"
											strokeWidth="1.5"
											filter={isHovered ? "url(#glowEffect)" : undefined}
										/>
									)}

									{/* Hover Trigger Zone */}
									<circle
										cx={p.x}
										cy={Math.min(p.y, act.hasData ? act.y : p.y)}
										r="20"
										fill="transparent"
										style={{ cursor: "pointer" }}
										onMouseEnter={() => setHoveredIndex(index)}
									/>

									{/* X-Axis labels */}
									<text x={p.x} y={height - 10} textAnchor="middle" fill="#475569" fontSize="11" fontWeight="700">
										{p.month}
									</text>
								</g>
							);
						})}

						{/* Tooltip Overlay */}
						{hoveredPoint && (() => {
							const predVal = hoveredPoint.pred.value;
							const actVal = hoveredPoint.act.value;
							const diff = actVal - predVal;
							const roundedDiff = Number(diff.toFixed(2));
							const comp = roundedDiff > 0 ? "greater" : roundedDiff < 0 ? "lesser" : "equal";
							return (
								<g>
									<rect
										x={tooltipX}
										y={8}
										width="140"
										height="82"
										rx="8"
										fill="rgba(15, 23, 42, 0.95)"
										stroke="rgba(255, 255, 255, 0.15)"
										strokeWidth="1"
									/>
									<text x={tooltipX + 12} y={24} fill="#ffffff" fontSize="11" fontWeight="800">
										{hoveredPoint.month} {selectedYear}
									</text>
									<text x={tooltipX + 12} y={42} fill="#94a3b8" fontSize="10" fontWeight="600">
										Predicted: <tspan fill="#ffffff" fontWeight="700">{predVal.toFixed(1)} kWh</tspan>
									</text>
									<text x={tooltipX + 12} y={58} fill="#94a3b8" fontSize="10" fontWeight="600">
										Actual: <tspan fill={hoveredPoint.act.hasData ? "#34d399" : "#ffffff"} fontWeight="700">
											{hoveredPoint.act.hasData ? `${actVal.toFixed(1)} kWh` : "N/A"}
										</tspan>
									</text>
									{hoveredPoint.act.hasData && (
										<text x={tooltipX + 12} y={74} fill="#94a3b8" fontSize="10" fontWeight="600">
											Status: <tspan 
												fill={comp === "greater" ? "#34d399" : comp === "lesser" ? "#f87171" : "#ffffff"} 
												fontWeight="800"
												className="uppercase"
											>
												{comp.toUpperCase()}
											</tspan>
										</text>
									)}
								</g>
							);
						})()}
					</svg>
				</div>
			) : (
				<div className="space-y-4">
					{/* Monthly Comparison Table */}
					<div className="overflow-x-auto rounded-lg border border-slate-200">
						<table className="w-full text-sm">
							<thead>
								<tr className="bg-slate-50 border-b border-slate-200 text-slate-700">
									<th className="px-4 py-3 text-left font-semibold">Month</th>
									<th className="px-4 py-3 text-right font-semibold">Predicted (kWh)</th>
									<th className="px-4 py-3 text-right font-semibold">Actual Produced (kWh)</th>
									<th className="px-4 py-3 text-right font-semibold">Difference (kWh)</th>
									<th className="px-4 py-3 text-center font-semibold">Status</th>
								</tr>
							</thead>
							<tbody>
								{MONTH_ORDER.map((month, idx) => {
									const predVal = Number(predictions[month] ?? 0);
									const actRec = actPoints.find((p) => p.month === month);
									const actVal = actRec?.value ?? 0;
									const hasData = actRec?.hasData ?? false;
									const diff = actVal - predVal;
									const roundedDiff = Number(diff.toFixed(2));
									const comparison = roundedDiff > 0 ? "greater" : roundedDiff < 0 ? "lesser" : "equal";

									return (
										<tr key={month} className={`border-b border-slate-100 ${idx % 2 === 0 ? "bg-white" : "bg-slate-50/50"}`}>
											<td className="px-4 py-3 font-semibold text-slate-900">{month} {selectedYear}</td>
											<td className="px-4 py-3 text-right text-slate-600 font-medium">{predVal.toFixed(2)}</td>
											<td className="px-4 py-3 text-right text-slate-800 font-bold">
												{hasData ? actVal.toFixed(2) : "—"}
											</td>
											<td className={`px-4 py-3 text-right font-bold ${!hasData ? "text-slate-400" : roundedDiff >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
												{hasData ? `${roundedDiff >= 0 ? "+" : ""}${roundedDiff.toFixed(2)}` : "—"}
											</td>
											<td className="px-4 py-3 text-center">
												{!hasData ? (
													<span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-500 border border-slate-200">
														No Data
													</span>
												) : comparison === "greater" ? (
													<span className="inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700 border border-emerald-200">
														▲ Greater Produced
													</span>
												) : comparison === "lesser" ? (
													<span className="inline-flex items-center rounded-full bg-rose-50 px-2.5 py-1 text-xs font-bold text-rose-700 border border-rose-200">
														▼ Lesser Produced
													</span>
												) : (
													<span className="inline-flex items-center rounded-full bg-blue-50 px-2.5 py-1 text-xs font-bold text-blue-700 border border-blue-200">
														■ Equal
													</span>
												)}
											</td>
										</tr>
									);
								})}
							</tbody>
						</table>
					</div>

					{/* Summary Statistics */}
					<div className="grid grid-cols-2 gap-3 sm:grid-cols-4 text-sm mt-4">
						<div className="rounded-xl border border-slate-200 bg-slate-50 p-3 shadow-sm">
							<p className="text-xs font-semibold text-slate-500 uppercase">YTD Actual Production</p>
							<p className="mt-1.5 text-xl font-black text-slate-900">{stats.actTotal.toFixed(1)} <span className="text-xs font-bold text-slate-500">kWh</span></p>
							<p className="text-xs text-slate-500 mt-1">{stats.monthsTracked} month(s) tracked</p>
						</div>
						<div className="rounded-xl border border-slate-200 bg-slate-50 p-3 shadow-sm">
							<p className="text-xs font-semibold text-slate-500 uppercase">Baseline Prediction</p>
							<p className="mt-1.5 text-xl font-black text-slate-900">{stats.predTotal.toFixed(1)} <span className="text-xs font-bold text-slate-500">kWh</span></p>
							<p className="text-xs text-slate-500 mt-1">Full-year baseline expectation</p>
						</div>
						<div className="rounded-xl border border-slate-200 bg-slate-50 p-3 shadow-sm">
							<p className="text-xs font-semibold text-slate-500 uppercase">Production Accuracy</p>
							<p className={`mt-1.5 text-xl font-black ${stats.netDiff >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
								{stats.netDiff >= 0 ? "+" : ""}{stats.netDiff.toFixed(1)} <span className="text-xs font-bold">kWh</span>
							</p>
							<p className="text-xs text-slate-500 mt-1">Difference YTD against prediction</p>
						</div>
						<div className="rounded-xl border border-slate-200 bg-slate-50 p-3 shadow-sm">
							<p className="text-xs font-semibold text-slate-500 uppercase">Performance Summary</p>
							<div className="mt-1.5 flex gap-2">
								<span className="text-emerald-600 font-bold">▲ {stats.greaterCount}</span>
								<span className="text-rose-600 font-bold">▼ {stats.lesserCount}</span>
							</div>
							<p className="text-xs text-slate-500 mt-1">Greater vs Lesser months</p>
						</div>
					</div>
				</div>
			)}
		</div>
	);
};

export default MonthlyLineChartWithTable;
