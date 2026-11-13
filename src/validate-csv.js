// functions.js must be imported first, so the circular imports between it and the Magic classes
// resolve in the right order
import { autoType, getCodeKey, getNameKey } from "./functions.js";
import MagicNumber from "./magic-number.js";
import parseRaw from "./parse-raw.js";

// Row number in a spreadsheet, where the header is row 1
const rowNum = (i) => i + 2;

// Cells with no value are null, or an empty array in "_array" columns
const isEmpty = (val) => val === null || (Array.isArray(val) && val.length === 0);

function getType(val) {
	if (val instanceof MagicNumber) return "number";
	if (val instanceof Date) return "date";
	if (Array.isArray(val)) return "array";
	return typeof val;
}

const check = (id, title, problems) => ({ id, title, passed: problems.length === 0, problems });

// Check a CSV string for problems that would break a robo-journalism template, as parsed by
// csvParse() with autoType. codeKey and nameKey choose the code and name columns (by default,
// they're detected). Returns a report object (see docs/api.md).
export default function validateCSV(str, { codeKey = null, nameKey = null } = {}) {
	const { raw: text, removed } = parseRaw(str);
	const data = text.map((d) => autoType({ ...d }));
	const columns = text.columns;

	const report = {
		rows: data.length,
		columns,
		removedBlankRows: removed,
		codeKey: null,
		nameKey: null,
		checks: [],
		problems: 0,
		passed: false,
		error: null
	};
	if (data.length === 0) {
		report.error = "No rows found";
		return report;
	}

	// 1. Code and name columns (given, or likely ones)
	const missing = [codeKey, nameKey].filter((key) => key != null && !columns.includes(key));
	if (missing.length) {
		report.error = `Column${missing.length > 1 ? "s" : ""} not found: ${missing.join(", ")}`;
		return report;
	}
	codeKey ??= getCodeKey(data[0]);
	nameKey ??= getNameKey(data[0]);
	const hasName = nameKey !== codeKey; // getNameKey falls back to the code column
	report.codeKey = codeKey;
	report.nameKey = hasName ? nameKey : null;

	const indexes = data.map((_, i) => i);
	const isBlank = (i) => columns.every((col) => isEmpty(data[i][col]));
	const name = (i) => (hasName && text[i][nameKey] ? text[i][nameKey] : null);
	const rowRef = (i) => ({ row: rowNum(i), name: name(i) });
	const describeRow = (i) => `row ${rowNum(i)}${name(i) ? ` (${name(i)})` : ""}`;

	// 2. Blank rows (blank rows at the end are removed by parseRaw, as in csvParse)
	const blank = indexes.filter(isBlank).map((i) => ({
		row: rowNum(i),
		message: `row ${rowNum(i)}`
	}));
	report.checks.push(check("blankRows", "Blank rows", blank));

	// 3. Rows with data but no code
	const noCode = indexes
		.filter((i) => isEmpty(data[i][codeKey]) && !isBlank(i))
		.map((i) => ({ ...rowRef(i), message: describeRow(i) }));
	report.checks.push(check("noCode", "Rows with no code", noCode));

	// 4. Rows with a code but no name (only if there's a name column)
	const noName = hasName
		? indexes
				.filter((i) => !isEmpty(data[i][codeKey]) && isEmpty(data[i][nameKey]))
				.map((i) => {
					const code = text[i][codeKey].trim();
					return { row: rowNum(i), code, message: `row ${rowNum(i)} (${code})` };
				})
		: [];
	report.checks.push(check("noName", "Rows with no name", noName));

	// 5. Duplicate codes
	const rowsByCode = new Map();
	for (const i of indexes) {
		if (isEmpty(data[i][codeKey])) continue;
		const code = String(data[i][codeKey]).trim();
		rowsByCode.set(code, [...(rowsByCode.get(code) ?? []), i]);
	}
	const duplicates = [...rowsByCode]
		.filter(([, rows]) => rows.length > 1)
		.map(([code, rows]) => ({
			code,
			rows: rows.map(rowRef),
			message: `${code}: ${rows.map(describeRow).join(", ")}`
		}));
	report.checks.push(check("duplicateCodes", "Duplicate codes", duplicates));

	// 6. Columns with mixed types (empty cells are valid in a column of any type)
	const mixed = [];
	for (const col of columns) {
		const byType = {};
		for (const i of indexes) {
			if (!isEmpty(data[i][col])) (byType[getType(data[i][col])] ??= []).push(i);
		}
		const types = Object.keys(byType);
		if (types.length < 2) continue;

		// The most common type comes first, followed by examples of each of the others
		types.sort((a, b) => byType[b].length - byType[a].length);
		const typeInfo = types.map((type, t) => ({
			type,
			count: byType[type].length,
			examples:
				t === 0
					? []
					: byType[type].slice(0, 3).map((i) => ({ row: rowNum(i), value: text[i][col] }))
		}));
		const summary = typeInfo.map((d) => `${d.count} ${d.type}`).join(", ");
		const examples = typeInfo.slice(1).map((d) => {
			const shown = d.examples.map((e) => `"${e.value}" (row ${e.row})`);
			const more = d.count - shown.length;
			return `${d.type}: ${shown.join(", ")}${more ? `, and ${more} more` : ""}`;
		});
		const hint = types.includes("array")
			? `A column of lists should have a name ending "_array", so a single value is a list too.`
			: null;
		mixed.push({
			column: col,
			types: typeInfo,
			hint,
			message: `${col}: ${summary}. ${examples.join("; ")}.${hint ? ` ${hint}` : ""}`
		});
	}
	report.checks.push(check("mixedTypes", "Columns with mixed types", mixed));

	report.problems = report.checks.filter((c) => !c.passed).length;
	report.passed = report.problems === 0;
	return report;
}
