import { useMemo, useState } from "react";

const MONTH_ORDER = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const MonthlyLineChart = ({ monthlyData = {} }) => {
	const values = MONTH_ORDER.map((month) => Number(monthlyData[month] ?? 0));
	const maxValue = Math.max(...values, 1);
	const [hoveredIndex, setHoveredIndex] = useState(null);

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

	const points = chartPoints.map((point) => `${point.x},${point.y}`).join(" ");
	const hoveredPoint = hoveredIndex !== null ? chartPoints[hoveredIndex] : null;
	const tooltipX = hoveredPoint
		? Math.min(Math.max(hoveredPoint.x - 58, 10), width - 126)
		: 0;

	return (
		<div className="rounded-2xl border border-slate-300/60 bg-white/90 p-4 shadow-lg backdrop-blur-sm">
			<div>
				<h3 className="text-xl font-bold tracking-tight text-slate-900">Monthly Solar Generation</h3>
				<p className="mt-1 text-sm text-slate-600">kWh trend from Jan to Dec. Hover points for exact values.</p>
			</div>
			<div className="mt-3 w-full overflow-x-auto">
				<svg
					viewBox={`0 0 ${width} ${height}`}
					className="block h-auto min-w-[640px] w-full"
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
		</div>
	);
};

export default MonthlyLineChart;
