import ExcelJS from "exceljs";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const C = {
	brandDark: "FF1B4332",
	brandMid: "FF2D6A4F",
	brandLight: "FFD8F3DC",
	accentDark: "FF1565C0",
	accentLight: "FFE3F2FD",
	slateLight: "FFF8FAFC",
	white: "FFFFFFFF",
	border: "FFB7E4C7",
	textDark: "FF0F172A",
	textMid: "FF374151"
};

const solidFill = (argb) => ({ type: "pattern", pattern: "solid", fgColor: { argb } });

const thinBorder = () => ({
	top: { style: "thin", color: { argb: C.border } },
	left: { style: "thin", color: { argb: C.border } },
	bottom: { style: "thin", color: { argb: C.border } },
	right: { style: "thin", color: { argb: C.border } }
});

const mediumBorder = () => ({
	top: { style: "medium", color: { argb: C.brandMid } },
	left: { style: "medium", color: { argb: C.brandMid } },
	bottom: { style: "medium", color: { argb: C.brandMid } },
	right: { style: "medium", color: { argb: C.brandMid } }
});

const toNumber = (value) => {
	const numberValue = Number(value);
	return Number.isFinite(numberValue) ? numberValue : 0;
};

const formatNumber = (value) => toNumber(value).toLocaleString("en-US", {
	maximumFractionDigits: 2,
	minimumFractionDigits: 2
});

const formatOptionalNumber = (value) => {
	if (value === null || value === undefined || value === "N/A") return "N/A";
	const numberValue = Number(value);
	return Number.isFinite(numberValue) ? numberValue : "N/A";
};

const normalizeMonthlyEntries = (monthlyRaw) => {
	if (Array.isArray(monthlyRaw)) {
		return MONTHS.map((month, index) => [month, toNumber(monthlyRaw[index])]);
	}

	if (monthlyRaw && typeof monthlyRaw === "object") {
		return MONTHS.map((month) => [month, toNumber(monthlyRaw[month] ?? monthlyRaw[month.toLowerCase()])]);
	}

	return MONTHS.map((month) => [month, 0]);
};

function styleSectionHeader(cell, text, bgArgb = C.accentLight, fgArgb = C.accentDark) {
	cell.value = text;
	cell.fill = solidFill(bgArgb);
	cell.font = { bold: true, size: 11, color: { argb: fgArgb } };
	cell.alignment = { vertical: "middle", horizontal: "left", indent: 1 };
	cell.border = {
		top: { style: "medium", color: { argb: fgArgb } },
		left: { style: "medium", color: { argb: fgArgb } },
		bottom: { style: "medium", color: { argb: fgArgb } },
		right: { style: "medium", color: { argb: fgArgb } }
	};
}

function styleColHeader(cell) {
	cell.fill = solidFill(C.brandMid);
	cell.font = { bold: true, size: 10, color: { argb: C.white } };
	cell.alignment = { vertical: "middle", horizontal: "center" };
	cell.border = thinBorder();
}

function styleDataCell(cell, align = "left", isAlt = false) {
	if (isAlt) cell.fill = solidFill("FFF0FFF4");
	cell.font = { size: 10, color: { argb: C.textDark } };
	cell.alignment = { vertical: "middle", horizontal: align };
	cell.border = thinBorder();
}

function styleLabelCell(cell) {
	cell.fill = solidFill(C.slateLight);
	cell.font = { bold: true, size: 10, color: { argb: C.textMid } };
	cell.alignment = { vertical: "middle", horizontal: "left", indent: 1 };
	cell.border = thinBorder();
}

async function downloadWorkbook(wb, filename) {
	const buffer = await wb.xlsx.writeBuffer();
	const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
	const url = URL.createObjectURL(blob);
	const a = document.createElement("a");
	a.href = url;
	a.download = filename;
	a.click();
	URL.revokeObjectURL(url);
}

function addSectionHeader(ws, row, text, bgArgb, fgArgb) {
	ws.mergeCells(`A${row}:F${row}`);
	styleSectionHeader(ws.getCell(`A${row}`), text, bgArgb, fgArgb);
	ws.getRow(row).height = 22;
	return row + 1;
}

function addSpacer(ws, row) {
	ws.addRow([]);
	ws.getRow(row).height = 6;
	return row + 1;
}

function addKeyValueRows(ws, row, rows) {
	let r = row;

	rows.forEach(([label, value], index) => {
		ws.mergeCells(`B${r}:F${r}`);
		ws.getCell(`A${r}`).value = label;
		ws.getCell(`B${r}`).value = value;
		styleLabelCell(ws.getCell(`A${r}`));
		styleDataCell(ws.getCell(`B${r}`), "left", index % 2 === 0);

		for (const col of ["C", "D", "E", "F"]) {
			const cell = ws.getCell(`${col}${r}`);
			if (index % 2 === 0) cell.fill = solidFill("FFF0FFF4");
			cell.border = thinBorder();
		}

		ws.getRow(r).height = 20;
		r += 1;
	});

	return r;
}

function addMonthlySection(ws, row, report) {
	let r = addSectionHeader(ws, row, "MONTHLY BREAKDOWN", C.brandLight, C.brandDark);

	["Month", "Energy (kWh)", "% of Annual", "", "", ""].forEach((header, index) => {
		const col = ["A", "B", "C", "D", "E", "F"][index];
		ws.getCell(`${col}${r}`).value = header;
		if (header) styleColHeader(ws.getCell(`${col}${r}`));
	});
	ws.getRow(r).height = 22;
	r += 1;

	const entries = normalizeMonthlyEntries(report?.monthly_energy_kwh);
	const monthlyTotal = entries.reduce((sum, [, value]) => sum + value, 0);

	entries.forEach(([month, energy], index) => {
		const pct = monthlyTotal > 0 ? `${((energy / monthlyTotal) * 100).toFixed(1)}%` : "0.0%";
		ws.getCell(`A${r}`).value = month;
		ws.getCell(`B${r}`).value = energy;
		ws.getCell(`C${r}`).value = pct;

		for (const col of ["D", "E", "F"]) {
			ws.getCell(`${col}${r}`).value = "";
		}

		styleDataCell(ws.getCell(`A${r}`), "left", index % 2 === 0);
		styleDataCell(ws.getCell(`B${r}`), "right", index % 2 === 0);
		styleDataCell(ws.getCell(`C${r}`), "right", index % 2 === 0);
		for (const col of ["D", "E", "F"]) styleDataCell(ws.getCell(`${col}${r}`), "left", index % 2 === 0);
		ws.getCell(`B${r}`).numFmt = "#,##0.00";
		ws.getRow(r).height = 20;
		r += 1;
	});

	for (const col of ["A", "B", "C", "D", "E", "F"]) {
		const cell = ws.getCell(`${col}${r}`);
		cell.fill = solidFill(C.brandMid);
		cell.font = { bold: true, size: 10, color: { argb: C.white } };
		cell.border = thinBorder();
		cell.alignment = { horizontal: col === "A" ? "left" : "right", vertical: "middle" };
	}

	ws.getCell(`A${r}`).value = "TOTAL";
	ws.getCell(`B${r}`).value = monthlyTotal;
	ws.getCell(`B${r}`).numFmt = "#,##0.00";
	ws.getCell(`C${r}`).value = monthlyTotal > 0 ? "100.0%" : "0.0%";
	ws.getRow(r).height = 22;

	return r + 1;
}

function addDailyPredictionRows(ws, row, dailyPredictions) {
	let r = addSectionHeader(ws, row, "DAILY PREDICTION HISTORY", C.accentLight, C.accentDark);

	["Date", "Predicted (kWh)", "Inverter (kWh)", "Peak Power (kW)", "Avg Temp (C)", "Cloud Cover (%)"].forEach((header, index) => {
		const col = ["A", "B", "C", "D", "E", "F"][index];
		ws.getCell(`${col}${r}`).value = header;
		styleColHeader(ws.getCell(`${col}${r}`));
	});
	ws.getRow(r).height = 22;
	r += 1;

	if (!dailyPredictions.length) {
		ws.mergeCells(`A${r}:F${r}`);
		const noDataCell = ws.getCell(`A${r}`);
		noDataCell.value = "No daily prediction data has been fetched yet.";
		noDataCell.fill = solidFill(C.slateLight);
		noDataCell.font = { italic: true, size: 10, color: { argb: "FF94A3B8" } };
		noDataCell.alignment = { horizontal: "center", vertical: "middle" };
		noDataCell.border = thinBorder();
		ws.getRow(r).height = 24;
		return r + 1;
	}

	dailyPredictions.forEach((item, index) => {
		const inverterValue = formatOptionalNumber(item.inverter_real_time_kwh);
		const rowValues = [
			item.date ?? "N/A",
			formatOptionalNumber(item.predicted_kwh),
			inverterValue,
			formatOptionalNumber(item.peak_power_kw),
			formatOptionalNumber(item.avg_temperature),
			formatOptionalNumber(item.avg_cloud_cover)
		];

		rowValues.forEach((value, colIndex) => {
			const col = ["A", "B", "C", "D", "E", "F"][colIndex];
			const cell = ws.getCell(`${col}${r}`);
			cell.value = value;
			styleDataCell(cell, colIndex === 0 ? "center" : "right", index % 2 === 0);
			if (typeof value === "number") cell.numFmt = "#,##0.00";
		});

		ws.getRow(r).height = 20;
		r += 1;
	});

	return r;
}

function buildSingleSheet(wb, report, user, options = {}) {
	const dailyPredictions = Array.isArray(options.dailyPredictions) ? options.dailyPredictions : [];
	const source = options.source ? String(options.source).toUpperCase() : report?.source ?? "N/A";
	const latestPrediction = dailyPredictions[0];
	const ws = wb.addWorksheet("Solar Report");

	ws.columns = [
		{ key: "A", width: 22 },
		{ key: "B", width: 18 },
		{ key: "C", width: 18 },
		{ key: "D", width: 18 },
		{ key: "E", width: 18 },
		{ key: "F", width: 18 }
	];

	ws.mergeCells("A1:F1");
	const logoCell = ws.getCell("A1");
	logoCell.value = "SolarWiser";
	logoCell.fill = solidFill(C.brandDark);
	logoCell.font = { bold: true, size: 22, color: { argb: C.white }, name: "Calibri" };
	logoCell.alignment = { vertical: "middle", horizontal: "center" };
	logoCell.border = mediumBorder();
	ws.getRow(1).height = 48;

	ws.mergeCells("A2:F2");
	const taglineCell = ws.getCell("A2");
	taglineCell.value = "Solar Energy Report";
	taglineCell.fill = solidFill(C.brandMid);
	taglineCell.font = { italic: true, size: 12, color: { argb: C.white } };
	taglineCell.alignment = { vertical: "middle", horizontal: "center" };
	ws.getRow(2).height = 22;

	ws.mergeCells("A3:F3");
	const dateCell = ws.getCell("A3");
	dateCell.value = `Generated: ${new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}`;
	dateCell.fill = solidFill(C.brandLight);
	dateCell.font = { italic: true, size: 9, color: { argb: C.brandDark } };
	dateCell.alignment = { horizontal: "center", vertical: "middle" };
	ws.getRow(3).height = 16;

	let r = 4;
	r = addSpacer(ws, r);

	r = addSectionHeader(ws, r, "USER DETAILS", C.brandLight, C.brandDark);
	r = addKeyValueRows(ws, r, [
		["Name", user?.name ?? "N/A"],
		["Email", user?.email ?? "N/A"],
		["Phone", user?.phoneNumber ?? "N/A"],
		["Latitude", user?.location?.latitude ?? "N/A"],
		["Longitude", user?.location?.longitude ?? "N/A"],
		["System Capacity", `${user?.systemCapacity ?? "N/A"} kW`],
		["Tilt Angle", `${user?.tiltDeg ?? "N/A"} deg`],
		["Azimuth Angle", `${user?.azimuthDeg ?? "N/A"} deg`],
		["Shading Factor", user?.shadingFactor ?? "N/A"]
	]);

	r = addSpacer(ws, r);

	r = addSectionHeader(ws, r, "ANNUAL SUMMARY", C.accentLight, C.accentDark);
	r = addKeyValueRows(ws, r, [
		["Model Source", source],
		["Annual Generation", `${formatNumber(report?.annual_energy_kwh)} kWh`],
		["Performance Ratio", `${formatNumber(toNumber(report?.performance_ratio) * 100)}%`],
		["DC/AC Ratio", report?.dc_ac_ratio ?? "N/A"],
		["Inverter Efficiency", report?.inv_efficiency ? `${report.inv_efficiency}%` : "N/A"],
		["Bifaciality", report?.bifaciality ?? "N/A"]
	]);

	r = addSpacer(ws, r);

	r = addSectionHeader(ws, r, "CURRENT FETCHED DAILY PREDICTION", C.brandLight, C.brandDark);
	r = addKeyValueRows(ws, r, [
		["Fetched Date", latestPrediction?.date ?? "N/A"],
		["Predicted Generation", latestPrediction ? `${formatNumber(latestPrediction.predicted_kwh)} kWh` : "N/A"],
		["Inverter Real Time", latestPrediction?.inverter_real_time_kwh ?? "N/A"],
		["Peak Power", latestPrediction ? `${formatNumber(latestPrediction.peak_power_kw)} kW` : "N/A"],
		["Avg Temperature", latestPrediction ? `${formatNumber(latestPrediction.avg_temperature)} C` : "N/A"],
		["Avg Cloud Cover", latestPrediction ? `${formatNumber(latestPrediction.avg_cloud_cover)}%` : "N/A"]
	]);

	r = addSpacer(ws, r);
	r = addMonthlySection(ws, r, report);
	r = addSpacer(ws, r);
	r = addDailyPredictionRows(ws, r, dailyPredictions);
	r = addSpacer(ws, r);

	ws.mergeCells(`A${r}:F${r}`);
	const footerCell = ws.getCell(`A${r}`);
	footerCell.value = "SolarWiser - Confidential Report";
	footerCell.fill = solidFill(C.brandDark);
	footerCell.font = { italic: true, size: 9, color: { argb: C.white } };
	footerCell.alignment = { horizontal: "center", vertical: "middle" };
	ws.getRow(r).height = 16;
}

export const exportReportToExcel = async (report, user, options = {}) => {
	const wb = new ExcelJS.Workbook();
	wb.creator = "SolarWiser";
	wb.created = new Date();
	wb.modified = new Date();

	buildSingleSheet(wb, report, user, options);

	const date = new Date().toISOString().slice(0, 10);
	const safeName = String(user?.name ?? "User").trim().replace(/[^a-z0-9_-]+/gi, "_") || "User";
	await downloadWorkbook(wb, `Solar_Report_${safeName}_${date}.xlsx`);
};
