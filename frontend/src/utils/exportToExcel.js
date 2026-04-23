import * as XLSX from "xlsx";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export const exportReportToExcel = (user, report) => {
	const wb = XLSX.utils.book_new();

	// Sheet 1: Summary
	const summaryData = [
		["Solar Report Summary"],
		[],
		["User Information"],
		["Name", user?.name ?? ""],
		["Email", user?.email ?? ""],
		["Phone", user?.phoneNumber ?? ""],
		["System Capacity (kW)", user?.systemCapacity ?? ""],
		["Tilt (deg)", user?.tiltDeg ?? ""],
		["Azimuth (deg)", user?.azimuthDeg ?? ""],
		["Shading Factor", user?.shadingFactor ?? ""],
		["Latitude", user?.location?.latitude ?? ""],
		["Longitude", user?.location?.longitude ?? ""],
		[],
		["Report Metrics"],
		["Annual Energy (kWh)", report?.annual_energy_kwh ?? ""],
		["Performance Ratio", report?.performance_ratio ?? ""],
		["Forecast Days Available", report?.forecast_7_days?.length ?? 0],
	];
	const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);
	XLSX.utils.book_append_sheet(wb, summarySheet, "Summary");

	// Sheet 2: Monthly Energy
	const monthlyRaw = report?.monthly_energy_kwh;
	if (monthlyRaw) {
		const monthlyRows = [["Month", "Energy (kWh)"]];
		if (Array.isArray(monthlyRaw)) {
			monthlyRaw.forEach((val, idx) => {
				monthlyRows.push([MONTHS[idx] ?? `Month ${idx + 1}`, val]);
			});
		} else if (typeof monthlyRaw === "object") {
			Object.entries(monthlyRaw).forEach(([key, val]) => {
				monthlyRows.push([key, val]);
			});
		}
		const monthlySheet = XLSX.utils.aoa_to_sheet(monthlyRows);
		XLSX.utils.book_append_sheet(wb, monthlySheet, "Monthly Energy");
	}

	// Sheet 3: 7-Day Forecast
	const forecast = report?.forecast_7_days;
	if (forecast?.length) {
		const forecastRows = [
			["Date", "Predicted (kWh)", "Cloud Cover (%)", "Temperature (deg C)"],
			...forecast.map((item) => [
				item.date ?? "",
				(item.predicted_kwh ?? 0).toFixed(2),
				item.cloud_cover ?? "",
				item.temperature ?? "",
			]),
		];
		const forecastSheet = XLSX.utils.aoa_to_sheet(forecastRows);
		XLSX.utils.book_append_sheet(wb, forecastSheet, "7-Day Forecast");
	}

	const date = new Date().toISOString().slice(0, 10);
	const safeName = (user?.name ?? "User").replace(/\s+/g, "_");
	XLSX.writeFile(wb, `Solar_Report_${safeName}_${date}.xlsx`);
};
