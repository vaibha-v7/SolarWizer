import ExcelJS from "exceljs";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// --- Colour palette (SolarWiser branding) ---
const C = {
	brandDark:   "1B4332",  // deep green
	brandMid:    "2D6A4F",  // mid green
	brandLight:  "D8F3DC",  // light green tint
	accentDark:  "1565C0",  // deep blue accent
	accentLight: "E3F2FD",  // light blue tint
	slateLight:  "F8FAFC",
	white:       "FFFFFFFF",
	border:      "B7E4C7",
	textDark:    "0F172A",
	textMid:     "374151",
};

// --- Reusable style helpers ---
const solidFill = (argb) => ({ type: "pattern", pattern: "solid", fgColor: { argb } });

const thinBorder = () => ({
	top:    { style: "thin", color: { argb: C.border } },
	left:   { style: "thin", color: { argb: C.border } },
	bottom: { style: "thin", color: { argb: C.border } },
	right:  { style: "thin", color: { argb: C.border } },
});

const mediumBorder = () => ({
	top:    { style: "medium", color: { argb: C.brandMid } },
	left:   { style: "medium", color: { argb: C.brandMid } },
	bottom: { style: "medium", color: { argb: C.brandMid } },
	right:  { style: "medium", color: { argb: C.brandMid } },
});

function styleSectionHeader(cell, text, bgArgb = C.accentLight, fgArgb = C.accentDark) {
	cell.value     = text;
	cell.fill      = solidFill(bgArgb);
	cell.font      = { bold: true, size: 11, color: { argb: fgArgb } };
	cell.alignment = { vertical: "middle", horizontal: "left", indent: 1 };
	cell.border    = {
		top:    { style: "medium", color: { argb: fgArgb } },
		left:   { style: "medium", color: { argb: fgArgb } },
		bottom: { style: "medium", color: { argb: fgArgb } },
		right:  { style: "medium", color: { argb: fgArgb } },
	};
}

function styleColHeader(cell) {
	cell.fill      = solidFill(C.brandMid);
	cell.font      = { bold: true, size: 10, color: { argb: C.white } };
	cell.alignment = { vertical: "middle", horizontal: "center" };
	cell.border    = thinBorder();
}

function styleDataCell(cell, align = "left", isAlt = false) {
	if (isAlt) cell.fill = solidFill("F0FFF4");
	cell.font      = { size: 10, color: { argb: C.textDark } };
	cell.alignment = { vertical: "middle", horizontal: align };
	cell.border    = thinBorder();
}

function styleLabelCell(cell) {
	cell.fill      = solidFill(C.slateLight);
	cell.font      = { bold: true, size: 10, color: { argb: C.textMid } };
	cell.alignment = { vertical: "middle", horizontal: "left", indent: 1 };
	cell.border    = thinBorder();
}

// --- Download helper ---
async function downloadWorkbook(wb, filename) {
	const buffer = await wb.xlsx.writeBuffer();
	const blob   = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
	const url    = URL.createObjectURL(blob);
	const a      = document.createElement("a");
	a.href       = url;
	a.download   = filename;
	a.click();
	URL.revokeObjectURL(url);
}

// ============================================================
// SINGLE SHEET – Complete Solar Report
// ============================================================
function buildSingleSheet(wb, user, report) {
	const ws = wb.addWorksheet("Solar Report");

	// Column widths – optimised for both mobile and desktop viewing
	ws.columns = [
		{ key: "A", width: 28 },
		{ key: "B", width: 22 },
		{ key: "C", width: 20 },
		{ key: "D", width: 22 },
	];

	// ── LOGO / BRAND HEADER ──────────────────────────────────
	ws.mergeCells("A1:D1");
	const logoCell = ws.getCell("A1");
	logoCell.value     = "\u2600  SolarWiser";
	logoCell.fill      = solidFill(C.brandDark);
	logoCell.font      = { bold: true, size: 22, color: { argb: C.white }, name: "Calibri" };
	logoCell.alignment = { vertical: "middle", horizontal: "center" };
	logoCell.border    = mediumBorder();
	ws.getRow(1).height = 48;

	ws.mergeCells("A2:D2");
	const taglineCell = ws.getCell("A2");
	taglineCell.value     = "Solar Energy Report";
	taglineCell.fill      = solidFill(C.brandMid);
	taglineCell.font      = { italic: true, size: 12, color: { argb: C.white } };
	taglineCell.alignment = { vertical: "middle", horizontal: "center" };
	ws.getRow(2).height = 22;

	ws.mergeCells("A3:D3");
	const dateCell = ws.getCell("A3");
	dateCell.value     = `Generated: ${new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}`;
	dateCell.fill      = solidFill(C.brandLight);
	dateCell.font      = { italic: true, size: 9, color: { argb: C.brandDark } };
	dateCell.alignment = { horizontal: "center", vertical: "middle" };
	ws.getRow(3).height = 16;

	// spacer
	ws.addRow([]);
	ws.getRow(4).height = 6;

	// ── SECTION: USER DETAILS ────────────────────────────────
	let r = 5;
	ws.mergeCells(`A${r}:D${r}`);
	styleSectionHeader(ws.getCell(`A${r}`), "USER DETAILS", C.brandLight, C.brandDark);
	ws.getRow(r).height = 22;
	r++;

	const userFields = [
		["Name",           user?.name              ?? "–"],
		["Email",          user?.email             ?? "–"],
		["Phone",          user?.phoneNumber        ?? "–"],
		["Latitude",       user?.location?.latitude  ?? "–"],
		["Longitude",      user?.location?.longitude ?? "–"],
		["System Capacity",`${user?.systemCapacity ?? "–"} kW`],
		["Tilt Angle",     `${user?.tiltDeg        ?? "–"} °`],
		["Azimuth Angle",  `${user?.azimuthDeg     ?? "–"} °`],
		["Shading Factor", user?.shadingFactor      ?? "–"],
	];

	userFields.forEach(([label, value], i) => {
		ws.mergeCells(`C${r}:D${r}`);
		const row = ws.getRow(r);
		row.height = 20;
		ws.getCell(`A${r}`).value = label;
		styleLabelCell(ws.getCell(`A${r}`));
		ws.getCell(`B${r}`).value = value;
		styleDataCell(ws.getCell(`B${r}`), "left", i % 2 === 0);
		// fill merged C:D with same alt colour
		const cCell = ws.getCell(`C${r}`);
		if (i % 2 === 0) cCell.fill = solidFill("F0FFF4");
		cCell.border = thinBorder();
		r++;
	});

	// spacer
	ws.addRow([]);
	ws.getRow(r).height = 6;
	r++;

	// ── SECTION: ANNUAL ENERGY DATA ─────────────────────────
	ws.mergeCells(`A${r}:D${r}`);
	styleSectionHeader(ws.getCell(`A${r}`), "ANNUAL ENERGY DATA", C.accentLight, C.accentDark);
	ws.getRow(r).height = 22;
	r++;

	const annualFields = [
		["Annual Generation",  `${(report?.annual_energy_kwh ?? 0).toLocaleString("en-US", { maximumFractionDigits: 2 })} kWh`],
		["Performance Ratio",  `${((report?.performance_ratio ?? 0) * 100).toFixed(1)} %`],
	];

	annualFields.forEach(([label, value], i) => {
		ws.mergeCells(`C${r}:D${r}`);
		ws.getCell(`A${r}`).value = label;
		styleLabelCell(ws.getCell(`A${r}`));
		ws.getCell(`B${r}`).value = value;
		styleDataCell(ws.getCell(`B${r}`), "left", i % 2 === 0);
		const cCell = ws.getCell(`C${r}`);
		if (i % 2 === 0) cCell.fill = solidFill("F0FFF4");
		cCell.border = thinBorder();
		ws.getRow(r).height = 20;
		r++;
	});

	// spacer
	ws.addRow([]);
	ws.getRow(r).height = 6;
	r++;

	// ── SECTION: MONTHLY BREAKDOWN ───────────────────────────
	ws.mergeCells(`A${r}:D${r}`);
	styleSectionHeader(ws.getCell(`A${r}`), "MONTHLY BREAKDOWN", C.brandLight, C.brandDark);
	ws.getRow(r).height = 22;
	r++;

	// column headers
	["Month", "Energy (kWh)", "% of Annual", ""].forEach((hdr, ci) => {
		const col = ["A", "B", "C", "D"][ci];
		ws.getCell(`${col}${r}`).value = hdr;
		if (hdr) styleColHeader(ws.getCell(`${col}${r}`));
	});
	ws.getRow(r).height = 22;
	r++;

	const monthlyRaw = report?.monthly_energy_kwh;
	const entries = [];
	if (Array.isArray(monthlyRaw)) {
		monthlyRaw.forEach((val, idx) => entries.push([MONTHS[idx] ?? `Month ${idx + 1}`, Number(val) || 0]));
	} else if (monthlyRaw && typeof monthlyRaw === "object") {
		Object.entries(monthlyRaw).forEach(([key, val]) => entries.push([key, Number(val) || 0]));
	}

	const monthlyTotal = entries.reduce((s, [, v]) => s + v, 0);

	entries.forEach(([month, energy], i) => {
		const pct = monthlyTotal > 0 ? ((energy / monthlyTotal) * 100).toFixed(1) : "0.0";
		ws.getCell(`A${r}`).value = month;
		ws.getCell(`B${r}`).value = energy;
		ws.getCell(`C${r}`).value = `${pct}%`;
		ws.getCell(`D${r}`).value = "";
		styleDataCell(ws.getCell(`A${r}`), "left",   i % 2 === 0);
		styleDataCell(ws.getCell(`B${r}`), "right",  i % 2 === 0);
		styleDataCell(ws.getCell(`C${r}`), "right",  i % 2 === 0);
		styleDataCell(ws.getCell(`D${r}`), "left",   i % 2 === 0);
		ws.getCell(`B${r}`).numFmt = "#,##0.00";
		ws.getRow(r).height = 20;
		r++;
	});

	if (entries.length) {
		["A", "B", "C", "D"].forEach((col) => {
			const cell = ws.getCell(`${col}${r}`);
			cell.fill      = solidFill(C.brandMid);
			cell.font      = { bold: true, size: 10, color: { argb: C.white } };
			cell.border    = thinBorder();
			cell.alignment = { horizontal: col === "A" ? "left" : "right", vertical: "middle" };
		});
		ws.getCell(`A${r}`).value = "TOTAL";
		ws.getCell(`B${r}`).value = monthlyTotal;
		ws.getCell(`B${r}`).numFmt = "#,##0.00";
		ws.getCell(`C${r}`).value = "100.0%";
		ws.getRow(r).height = 22;
		r++;
	}

	// spacer
	ws.addRow([]);
	ws.getRow(r).height = 6;
	r++;

	// ── SECTION: 7-DAY FORECAST ──────────────────────────────
	ws.mergeCells(`A${r}:D${r}`);
	styleSectionHeader(ws.getCell(`A${r}`), "7-DAY FORECAST", C.accentLight, C.accentDark);
	ws.getRow(r).height = 22;
	r++;

	// column headers
	["Date", "Predicted (kWh)", "Cloud Cover (%)", "Temperature (°C)"].forEach((hdr, ci) => {
		const col = ["A", "B", "C", "D"][ci];
		ws.getCell(`${col}${r}`).value = hdr;
		styleColHeader(ws.getCell(`${col}${r}`));
	});
	ws.getRow(r).height = 22;
	r++;

	const forecast = report?.forecast_7_days;
	if (forecast?.length) {
		forecast.forEach((item, i) => {
			ws.getCell(`A${r}`).value = item.date ?? "";
			ws.getCell(`B${r}`).value = Number((item.predicted_kwh ?? 0).toFixed(2));
			ws.getCell(`C${r}`).value = item.cloud_cover ?? "";
			ws.getCell(`D${r}`).value = item.temperature ?? "";
			styleDataCell(ws.getCell(`A${r}`), "center", i % 2 === 0);
			styleDataCell(ws.getCell(`B${r}`), "right",  i % 2 === 0);
			styleDataCell(ws.getCell(`C${r}`), "right",  i % 2 === 0);
			styleDataCell(ws.getCell(`D${r}`), "right",  i % 2 === 0);
			ws.getCell(`B${r}`).numFmt = "#,##0.00";
			ws.getRow(r).height = 20;
			r++;
		});
	} else {
		ws.mergeCells(`A${r}:D${r}`);
		const noDataCell = ws.getCell(`A${r}`);
		noDataCell.value     = "No forecast data available for this report.";
		noDataCell.fill      = solidFill(C.slateLight);
		noDataCell.font      = { italic: true, size: 10, color: { argb: "94A3B8" } };
		noDataCell.alignment = { horizontal: "center", vertical: "middle" };
		ws.getRow(r).height  = 24;
		r++;
	}

	// ── FOOTER ───────────────────────────────────────────────
	ws.addRow([]);
	ws.getRow(r).height = 6;
	r++;

	ws.mergeCells(`A${r}:D${r}`);
	const footerCell = ws.getCell(`A${r}`);
	footerCell.value     = "© SolarWiser — Confidential Report";
	footerCell.fill      = solidFill(C.brandDark);
	footerCell.font      = { italic: true, size: 9, color: { argb: C.white } };
	footerCell.alignment = { horizontal: "center", vertical: "middle" };
	ws.getRow(r).height  = 16;
}

// ============================================================
// MAIN export function
// ============================================================
export const exportReportToExcel = async (user, report) => {
	const wb = new ExcelJS.Workbook();
	wb.creator  = "SolarWiser";
	wb.created  = new Date();
	wb.modified = new Date();

	buildSingleSheet(wb, user, report);

	const date     = new Date().toISOString().slice(0, 10);
	const safeName = (user?.name ?? "User").replace(/\s+/g, "_");
	await downloadWorkbook(wb, `Solar_Report_${safeName}_${date}.xlsx`);
};
