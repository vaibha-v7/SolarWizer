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

function addSectionHeader(ws, row, text, bgArgb, fgArgb, startCol = "A", endCol = "F") {
	ws.mergeCells(`${startCol}${row}:${endCol}${row}`);
	styleSectionHeader(ws.getCell(`${startCol}${row}`), text, bgArgb, fgArgb);
	ws.getRow(row).height = 22;
	return row + 1;
}

function addSpacer(ws, row) {
	ws.addRow([]);
	ws.getRow(row).height = 6;
	return row + 1;
}

function addKeyValueRows(ws, row, rows, startColLabel = "A", startColValue = "B", endColValue = "F") {
	let r = row;

	rows.forEach(([label, value], index) => {
		ws.mergeCells(`${startColValue}${r}:${endColValue}${r}`);
		ws.getCell(`${startColLabel}${r}`).value = label;
		ws.getCell(`${startColValue}${r}`).value = value;
		styleLabelCell(ws.getCell(`${startColLabel}${r}`));
		styleDataCell(ws.getCell(`${startColValue}${r}`), "left", index % 2 === 0);

		// Fill borders for merged cells manually since ExcelJS requires it
		const colLetters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
		const startIdx = colLetters.indexOf(startColValue) + 1;
		const endIdx = colLetters.indexOf(endColValue);
		for (let i = startIdx; i <= endIdx; i++) {
			const col = colLetters[i];
			const cell = ws.getCell(`${col}${r}`);
			if (index % 2 === 0) cell.fill = solidFill("FFF0FFF4");
			cell.border = thinBorder();
		}

		ws.getRow(r).height = 20;
		r += 1;
	});

	return r;
}

module.exports = {
	C,
	solidFill,
	thinBorder,
	mediumBorder,
	styleSectionHeader,
	styleColHeader,
	styleDataCell,
	styleLabelCell,
	addSectionHeader,
	addSpacer,
	addKeyValueRows
};
