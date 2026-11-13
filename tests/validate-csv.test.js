import { describe, expect, test, vi } from "vitest";
import validateCSV from "../src/validate-csv.js";

const csv = (...lines) => lines.join("\n");
const header = "areacd,areanm,value";
const problems = (report, id) => report.checks.find((c) => c.id === id).problems;

describe("validateCSV()", () => {
	test("passes clean data and reports the code and name columns", () => {
		const report = validateCSV(csv(header, "E1,Hull,5", "E2,Leeds,7"));
		expect(report).toMatchObject({
			rows: 2,
			columns: ["areacd", "areanm", "value"],
			removedBlankRows: 0,
			codeKey: "areacd",
			nameKey: "areanm",
			problems: 0,
			passed: true,
			error: null
		});
		expect(report.checks.map((c) => c.id)).toEqual([
			"blankRows",
			"noCode",
			"noName",
			"duplicateCodes",
			"mixedTypes"
		]);
		expect(report.checks.every((c) => c.passed)).toBe(true);
	});

	test("returns an error when there are no rows", () => {
		const report = validateCSV(header);
		expect(report).toMatchObject({ rows: 0, passed: false, error: "No rows found" });
		expect(report.checks).toEqual([]);
	});

	test("nameKey is null when there's no name column", () => {
		expect(validateCSV(csv("areacd,value", "E1,5")).nameKey).toBeNull();
	});

	test("counts blank rows at the end without reporting them, and doesn't log", () => {
		const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
		const report = validateCSV(csv(header, "E1,Hull,5", ",,", ",,"));
		expect(report.rows).toBe(1);
		expect(report.removedBlankRows).toBe(2);
		expect(report.passed).toBe(true);
		expect(warn).not.toHaveBeenCalled();
		warn.mockRestore();
	});

	test("reports blank rows in the middle, by spreadsheet row number", () => {
		const report = validateCSV(csv(header, "E1,Hull,5", ",,", "E2,Leeds,7"));
		expect(problems(report, "blankRows")).toEqual([{ row: 3, message: "row 3" }]);
		expect(report.problems).toBe(1);
		expect(report.passed).toBe(false);
	});

	test("reports rows with data but no code", () => {
		const report = validateCSV(csv(header, "E1,Hull,5", ",Leeds,7", ",,3"));
		expect(problems(report, "noCode")).toEqual([
			{ row: 3, name: "Leeds", message: "row 3 (Leeds)" },
			{ row: 4, name: null, message: "row 4" }
		]);
	});

	test("reports rows with a code but no name", () => {
		const report = validateCSV(csv(header, "E1,Hull,5", "E2,,7", ",,3"));
		expect(problems(report, "noName")).toEqual([{ row: 3, code: "E2", message: "row 3 (E2)" }]);
		expect(problems(report, "noCode")).toHaveLength(1); // row 4 is reported as having no code
	});

	test("doesn't check names when there's no name column", () => {
		const report = validateCSV(csv("areacd,value", "E1,5", "E2,"));
		expect(problems(report, "noName")).toEqual([]);
		expect(report.passed).toBe(true);
	});

	test("codeKey and nameKey choose the columns", () => {
		const report = validateCSV(csv("areacd,areanm,id,label", "E1,Hull,1,A", "E1,Leeds,2,"), {
			codeKey: "id",
			nameKey: "label"
		});
		expect([report.codeKey, report.nameKey]).toEqual(["id", "label"]);
		expect(problems(report, "duplicateCodes")).toEqual([]);
		expect(problems(report, "noName")).toEqual([{ row: 3, code: "2", message: "row 3 (2)" }]);

		// Only one of them, or the same column for both (no name column)
		expect(validateCSV(csv(header, "E1,Hull,5"), { nameKey: "value" }).codeKey).toBe("areacd");
		expect(
			validateCSV(csv(header, "E1,Hull,5"), { codeKey: "areacd", nameKey: "areacd" }).nameKey
		).toBeNull();
	});

	test("returns an error for columns that aren't in the CSV", () => {
		const report = validateCSV(csv(header, "E1,Hull,5"), { codeKey: "id", nameKey: "label" });
		expect(report).toMatchObject({ passed: false, error: "Columns not found: id, label" });
		expect(report.checks).toEqual([]);
		expect(validateCSV(csv(header, "E1,Hull,5"), { codeKey: "id" }).error).toBe(
			"Column not found: id"
		);
	});

	test("reports duplicate codes, ignoring surrounding spaces", () => {
		const report = validateCSV(csv(header, "E1,Hull,5", "E2,Leeds,7", " E1 ,Hull again,6"));
		expect(problems(report, "duplicateCodes")).toEqual([
			{
				code: "E1",
				rows: [
					{ row: 2, name: "Hull" },
					{ row: 4, name: "Hull again" }
				],
				message: "E1: row 2 (Hull), row 4 (Hull again)"
			}
		]);
	});

	test("reports columns with mixed types, most common type first", () => {
		const report = validateCSV(
			csv(
				header,
				"E1,Hull,5",
				"E2,Leeds,NA",
				"E3,York,6",
				"E4,Bath,",
				"E5,Bury,x",
				"E6,Ely,y"
			)
		);
		const [mixed] = problems(report, "mixedTypes");
		expect(mixed).toMatchObject({ column: "value", hint: null });
		expect(mixed.types).toEqual([
			{
				type: "string",
				count: 3,
				examples: []
			},
			{
				type: "number",
				count: 2,
				examples: [
					{ row: 2, value: "5" },
					{ row: 4, value: "6" }
				]
			}
		]);
		expect(mixed.message).toBe('value: 3 string, 2 number. number: "5" (row 2), "6" (row 4).');
	});

	test("shows at most 3 examples of each type, and suggests _array for lists", () => {
		const rows = ["E1,A,1", "E2,B,1", "E3,C,1", "E4,D,1", "E5,E,1"];
		const lists = ["E6,F,a|b", "E7,G,c|d", "E8,H,e|f", "E9,I,g|h"];
		const [mixed] = problems(report(rows, lists), "mixedTypes");
		expect(mixed.types[1].examples).toHaveLength(3);
		expect(mixed.message).toBe(
			'value: 5 number, 4 array. array: "a|b" (row 7), "c|d" (row 8), "e|f" (row 9), and 1 more. ' +
				'A column of lists should have a name ending "_array", so a single value is a list too.'
		);

		function report(...groups) {
			return validateCSV(csv(header, ...groups.flat()));
		}
	});

	test("empty cells and empty _array cells don't count as a type", () => {
		const report = validateCSV(csv("areacd,areanm,tags_array", "E1,Hull,a|b", "E2,Leeds,"));
		expect(report.passed).toBe(true);
	});
});
