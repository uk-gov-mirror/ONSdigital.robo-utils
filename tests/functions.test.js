import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import * as robo from "../src/functions.js";
import MagicNumber from "../src/magic-number.js";
import MagicArray from "../src/magic-array.js";
import MagicObject from "../src/magic-object.js";

describe("toWords()", () => {
	test('toWords(1, "ordinal", {dropFirst: true}) should be ""', () => {
		expect(robo.toWords(1, "ordinal", { dropFirst: true })).toBe("");
	});

	test('toWords(10, "ordinal") should be "10th"', () => {
		expect(robo.toWords(10, "ordinal")).toBe("10th");
	});

	test.each([
		[5, "cardinal", undefined, "five"],
		[9, "cardinal", undefined, "nine"],
		[10, "cardinal", undefined, "10"],
		[1500, "cardinal", undefined, "1,500"],
		[15, "cardinal", { threshold: 20 }, "fifteen"],
		[2500, "cardinal", { threshold: -1 }, "two thousand, five hundred"],
		[2, "ordinal", undefined, "second"],
		[21, "ordinal", undefined, "21st"],
		[1, "ordinal", undefined, "first"],
		[2, "ordinal", { dropFirst: true }, "second"]
	])("toWords(%s, %j, %j) is %j", (value, type, options, expected) => {
		expect(robo.toWords(value, type, options)).toBe(expected);
		expect(n(value).toWords(type, options)).toBe(expected);
	});
});

describe("toList()", () => {
	test.each([
		[["red", "green", "blue"], undefined, undefined, "red, green and blue"],
		[["red", "green", "blue"], null, [", ", " or "], "red, green or blue"],
		[["red"], undefined, undefined, "red"],
		[[{ name: "A" }, { name: "B" }], "name", undefined, "A and B"],
		[[{ name: "a" }, { name: "b" }], (d) => d.name.toUpperCase(), undefined, "A and B"]
	])("toList(%j, %s, %j) is %j", (array, key, separator, expected) => {
		expect(robo.toList(array, key, separator)).toBe(expected);
	});
});

describe("breaksToWords()", () => {
	test("-1 is less than 0", () => {
		expect(robo.breaksToWords(-1)).toEqual("less");
	});

	test("1 is more than 0", () => {
		expect(robo.breaksToWords(1)).toEqual("more");
		expect(robo.breaksToWords(7, [4, 6], ["less", "about the same", "more"])).toEqual("more");
	});

	test('5 is "about the same" as 4 to 6', () => {
		expect(robo.breaksToWords(5, [4, 6], ["less", "about the same", "more"])).toEqual(
			"about the same"
		);
	});

	test.each([4, 6])('%i is "roughly about the same" as 4 to 6', (value) => {
		expect(
			robo.breaksToWords(value, [4, 6], ["less", "about the same", "more"], "roughly")
		).toEqual("roughly about the same");
	});
});

describe("formatName()", () => {
	test.each([
		["North West", null, "North West"],
		["North West", "the", "the North West"],
		["North West", "in", "in the North West"],
		["North West", "its", "the North West's"],
		["London", "the", "London"],
		["London", "in", "in London"],
		["London", "its", "London's"],
		["Derbyshire Dales", "its", "the Derbyshire Dales'"], // not s's
		["Isle of Wight", "in", "on the Isle of Wight"],
		["City of London", "in", "in the City of London"],
		["Vale of Glamorgan", "the", "the Vale of Glamorgan"],
		["United Kingdom", "in", "in the United Kingdom"],
		["Kingston upon Hull, City of", null, "Kingston upon Hull"],
		["Herefordshire, County of", null, "Herefordshire"],
		["Brighton & Hove", null, "Brighton and Hove"],
		["East", "in", "in the East of England"]
	])("formatName(%j, %j) is %j", (name, context, expected) => {
		expect(robo.formatName(name, context)).toBe(expected);
	});

	test("a missing name is an empty string, and a number is text", () => {
		expect(robo.formatName(null)).toBe("");
		expect(robo.formatName(undefined, "in")).toBe("");
		expect(robo.formatName(null, "in", "prefix")).toBe("");
		expect(robo.formatName(n(2019), "in")).toBe("in 2019");
		expect(robo.getName({ areacd: "E1", areanm: null }, "the")).toBe("");
	});

	test("mode other than default returns only the prefix", () => {
		expect(robo.formatName("North West", "in", "prefix")).toBe("in the");
		expect(robo.formatName("London", "in", "prefix")).toBe("in");
	});
});

describe("getCodeKey() / getNameKey() / getParentKey()", () => {
	test.each([
		[{ areacd: "E1", areanm: "Foo", parentcd: "E12" }, ["areacd", "areanm", "parentcd"]],
		[{ AREACD: "E1", AREANM: "Foo" }, ["AREACD", "AREANM", null]],
		[{ LAD21CD: "E1", LAD21NM: "Foo", RGN21CD: "E12" }, ["LAD21CD", "LAD21NM", null]],
		[{ code: "E1", name: "Foo", region: "R" }, ["code", "name", "region"]],
		[{ id: "E1", label: "Foo", parent: "P" }, ["id", "label", "parent"]],
		[{ hclnm: "Foo", areacd: "E1", areanm: "Bar" }, ["areacd", "hclnm", null]],
		[{ lad_code: "E1", lad_name: "Foo" }, ["lad_code", "lad_name", null]],
		[{ value: 1, LA_CODE: "E1", LA_NAME: "Foo" }, ["LA_CODE", "LA_NAME", null]],
		[{ areacd: "E1", lad21nm: "Foo" }, ["areacd", "lad21nm", null]], // a name column beats areacd
		[{ value: 1, areacd: "E1" }, ["areacd", "areacd", null]], // areacd is the last resort for names
		[{ foo: "a", bar: "b" }, ["foo", "foo", null]] // falls back to the first column
	])("%j", (row, expected) => {
		expect([robo.getCodeKey(row), robo.getNameKey(row), robo.getParentKey(row)]).toEqual(
			expected
		);
	});

	test("getCode(), getName() and getParent() use the detected keys", () => {
		const row = { LAD21CD: "E1", LAD21NM: "Brighton & Hove", RGNCD: "E12", REGIONCD: "x" };
		expect(robo.getCode(row)).toBe("E1");
		expect(robo.getName(row, "in")).toBe("in Brighton and Hove");
		expect(robo.getParent({ areacd: "E1", regioncd: "E12" })).toBe("E12");
		expect(robo.getParent({ areacd: "E1" })).toBeUndefined();
	});
});

describe("abs()", () => {
	test("returns the absolute value as a MagicNumber", () => {
		expect(robo.abs(-5)).toBeInstanceOf(MagicNumber);
		expect(+robo.abs(-5)).toBe(5);
		expect(+n(-2.5).abs()).toBe(2.5);
		expect(n(-1234).abs().format()).toBe("1,234");
	});
});

describe("round()", () => {
	test("round(123.4567, 2) should return 123.46", () => {
		expect(robo.round(123.4567, 2)).toBe(123.46);
	});

	test("round(123.4567, -2) should return 100", () => {
		expect(robo.round(123.4567, -2)).toBe(100);
	});

	test("accepts MagicNumbers", () => {
		expect(robo.round(n(123.4567), 2)).toBe(123.46);
	});

	test("MagicNumber.round() returns a MagicNumber", () => {
		const value = n(1234.567).round(-2);
		expect(value).toBeInstanceOf(MagicNumber);
		expect(+value).toBe(1200);
		expect(value.format()).toBe("1,200");
	});
});

describe("format()", () => {
	test("format(1234.567, ',.2f') should return 1,234.57", () => {
		expect(robo.format(1234.567, ",.2f")).toBe("1,234.57");
	});

	test("format(1234.567, ',.-2f') should return 1,200", () => {
		expect(robo.format(1234.567, ",.-2f")).toBe("1,200");
	});

	test.each([
		[1234, undefined, undefined, "1,234"],
		[-1234, undefined, undefined, "−1,234"],
		[1234567, ".3s", undefined, "1.23 million"],
		[1234567, ".3s", "short", "1.23mn"],
		[1234567000, ".2s", undefined, "1.2 billion"],
		[1234567000, ".2s", "short", "1.2bn"],
		[1.5e12, ".2s", undefined, "1.5 trillion"],
		[12345, ".2s", undefined, "12 thousand"],
		[1234.5, "$,.2f", undefined, "£1,234.50"],
		[0.123, ".1%", undefined, "12.3%"],
		[987654, ",.-3f", undefined, "988,000"]
	])("format(%s, %j, %j) is %j", (value, str, si, expected) => {
		expect(robo.format(value, str, si)).toBe(expected);
		expect(n(value).format(str, si)).toBe(expected);
	});
});

describe("toData()", () => {
	const rows = [
		{ areacd: "E1", areanm: "Foo", v: 1 },
		{ areacd: "E2", areanm: "Bar", v: 2 }
	];

	test("returns an array that converts to a JSON string", () => {
		const data = robo.toData(rows, { x: "v", y: "areanm" });
		expect(data).toEqual([
			{ x: 1, y: "Foo" },
			{ x: 2, y: "Bar" }
		]);
		expect(String(data)).toBe(JSON.stringify(data));
		expect(Object.keys(data)).toEqual(["0", "1"]); // toString is not enumerable
	});

	test("arrays of columns create one row per column, with array labels", () => {
		const wide = [
			{ areanm: "Foo", p2011: 10, p2021: 12 },
			{ areanm: "Bar", p2011: 20, p2021: 18 }
		];
		expect(
			robo.toData(wide, { x: ["2011", "2021"], y: ["p2011", "p2021"], z: "areanm" })
		).toEqual([
			{ z: "Foo", x: "2011", y: 10 },
			{ z: "Foo", x: "2021", y: 12 },
			{ z: "Bar", x: "2011", y: 20 },
			{ z: "Bar", x: "2021", y: 18 }
		]);
	});

	test("props with empty values are left out", () => {
		expect(robo.toData(rows, { x: "v", y: null, z: "" })).toEqual([{ x: 1 }, { x: 2 }]);
	});

	test("returns empty data (and warns) if it fails", () => {
		const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
		expect(robo.toData(rows, null)).toEqual([]);
		expect(robo.toData(rows, null, "stringify")).toBe("[]");
		expect(robo.toData(rows, null, "protect")).toBe("§[]§");
		expect(warn).toHaveBeenCalledTimes(3);
		warn.mockRestore();
	});

	test("stringify and protect modes return strings", () => {
		const json = '[{"y":"Foo"},{"y":"Bar"}]';
		expect(robo.toData(rows, { y: "areanm" }, "stringify")).toBe(json);
		expect(robo.toData(rows, { y: "areanm" }, "protect")).toBe(`§${json}§`);
	});
});

describe("autoType()", () => {
	const parse = (value, key = "v") => robo.autoType({ [key]: value })[key];

	test("returns a MagicObject", () => {
		expect(robo.autoType({ v: "1" })).toBeInstanceOf(MagicObject);
	});

	test.each([
		["42", 42],
		["-3.5", -3.5],
		["0", 0],
		["1e3", 1000],
		[" 7 ", 7],
		["Infinity", Infinity],
		["NaN", NaN],
		["2019", 2019] // a bare year is a number, not a date
	])("%j becomes MagicNumber(%s)", (cell, expected) => {
		const value = parse(cell);
		expect(value).toBeInstanceOf(MagicNumber);
		expect(value.valueOf()).toBe(expected);
	});

	test("numbers can use MagicNumber methods", () => {
		expect(parse("1234567").format(",")).toBe("1,234,567");
		expect(parse("NaN").format(",")).toBe("NaN");
	});

	test.each([
		["true", true],
		["false", false],
		["", null],
		["   ", null],
		["TRUE", "TRUE"], // only lowercase booleans are converted
		["1,234", "1,234"],
		["E06000001", "E06000001"],
		["Hartlepool", "Hartlepool"]
	])("%j becomes %j", (cell, expected) => {
		expect(parse(cell)).toBe(expected);
	});

	test.each([
		["a|b", ["a", "b"]],
		["a|b|", ["a", "b"]], // trailing separator is dropped
		["1|2", ["1", "2"]] // array items are not type-converted
	])("%j becomes an array", (cell, expected) => {
		expect(parse(cell)).toEqual(expected);
	});

	test.each([
		["a|b", ["a", "b"]],
		["a", ["a"]],
		["2020", ["2020"]],
		["true", ["true"]],
		["", []]
	])("%j in an _array column becomes %j", (cell, expected) => {
		expect(parse(cell, "years_array")).toEqual(expected);
	});

	describe("dates", () => {
		test("date-only values are UTC midnight", () => {
			const value = parse("2019-03-04");
			expect(value).toBeInstanceOf(Date);
			expect(value.toISOString()).toBe("2019-03-04T00:00:00.000Z");
			expect(parse("2019-03").toISOString()).toBe("2019-03-01T00:00:00.000Z");
		});

		test("date-times without a timezone are local time", () => {
			const value = parse("2019-07-04T12:30");
			expect([value.getFullYear(), value.getMonth(), value.getDate()]).toEqual([2019, 6, 4]);
			expect([value.getHours(), value.getMinutes()]).toEqual([12, 30]);
		});

		test("date-times with a timezone are respected", () => {
			expect(parse("2019-07-04T12:30Z").toISOString()).toBe("2019-07-04T12:30:00.000Z");
			expect(parse("2019-07-04T12:30+01:00").toISOString()).toBe("2019-07-04T11:30:00.000Z");
		});
	});
});

describe("csvParse()", () => {
	const csv = 'areacd,areanm,value,tags\nE1,"Hull, City of",5,a|b\nE2,Leeds\n';

	test("parses rows into MagicObjects with typed values", () => {
		const rows = robo.csvParse(csv);
		expect(rows.length).toBe(2);
		expect(rows.columns).toEqual(["areacd", "areanm", "value", "tags"]);
		expect(rows[0]).toBeInstanceOf(MagicObject);
		expect(rows[0].areanm).toBe("Hull, City of");
		expect(rows[0].value).toBeInstanceOf(MagicNumber);
		expect(rows[0].tags).toEqual(["a", "b"]);
	});

	test("missing trailing cells become null", () => {
		const row = robo.csvParse(csv)[1];
		expect(row.value).toBeNull();
		expect(row.tags).toBeNull();
	});

	test("strips a leading byte-order mark from the first column name", () => {
		expect(robo.csvParse("﻿" + csv).columns[0]).toBe("areacd");
	});

	test("accepts a custom row function in place of autoType", () => {
		expect(robo.csvParse(csv, (d) => d)[0].value).toBe("5");
	});

	describe("blank rows", () => {
		let warn;
		beforeEach(() => {
			warn = vi.spyOn(console, "warn").mockImplementation(() => {});
		});
		afterEach(() => warn.mockRestore());

		const head = "areacd,areanm,value\r\nE1,Hull,5\r\nE2,Leeds,7\r\n";

		test("removes trailing blank rows (CRLF, whitespace, quoted empties) with a warning", () => {
			const rows = robo.csvParse(head + ',,\r\n , ,\r\n"","",""\r\n\r\n');
			expect(rows.map((d) => d.areanm)).toEqual(["Hull", "Leeds"]);
			expect(rows.columns).toEqual(["areacd", "areanm", "value"]);
			expect(warn).toHaveBeenCalledTimes(1);
			expect(warn.mock.calls[0][0]).toMatch("removed 4 blank rows");
		});

		test("keeps blank rows that aren't at the end", () => {
			const rows = robo.csvParse("areacd,areanm\nE1,Hull\n,\nE2,Leeds\n,\n");
			expect(rows.map((d) => d.areanm)).toEqual(["Hull", null, "Leeds"]);
			expect(warn.mock.calls[0][0]).toMatch("removed 1 blank row ");
		});

		test("doesn't warn when there are no blank rows", () => {
			robo.csvParse(head);
			expect(warn).not.toHaveBeenCalled();
		});

		test("custom row functions get the index and columns, and can skip rows", () => {
			const calls = [];
			const rows = robo.csvParse(head + ",,\r\n", (d, i, cols) => {
				calls.push([i, cols.length]);
				return i === 0 ? null : d;
			});
			expect(calls).toEqual([
				[0, 3],
				[1, 3]
			]);
			expect(rows.map((d) => d.areanm)).toEqual(["Leeds"]);
		});
	});
});

describe("getExtreme()", () => {
	// keys defaults to Object.keys(obj)
	const cases = [
		{ name: "distinct values", obj: { a: 10, b: 25, c: 5, d: 15 }, highest: "b", lowest: "c" },
		{
			name: "all equal returns first key",
			obj: { x: 10, y: 10, z: 10 },
			highest: "x",
			lowest: "x"
		},
		{
			name: "ties return first key",
			obj: { a: 10, b: 20, c: 20, d: 10 },
			highest: "b",
			lowest: "a"
		},
		{ name: "single key", obj: { a: 42 }, highest: "a", lowest: "a" },
		{
			name: "negative numbers",
			obj: { a: -10, b: -5, c: -15, d: -2 },
			highest: "d",
			lowest: "c"
		},
		{ name: "mixed signs", obj: { a: -10, b: 5, c: -15, d: 2 }, highest: "b", lowest: "c" },
		{ name: "zeros", obj: { a: 0, b: -5, c: 3, d: 0 }, highest: "c", lowest: "b" },
		{ name: "decimals", obj: { a: 1.5, b: 1.7, c: 1.3, d: 1.9 }, highest: "d", lowest: "c" },
		{
			name: "large numbers",
			obj: { a: 1000000, b: 999999, c: 1000001 },
			highest: "c",
			lowest: "b"
		},
		{ name: "scientific notation", obj: { a: 1e5, b: 1e6, c: 1e4 }, highest: "b", lowest: "c" },
		{
			name: "Infinity and -Infinity",
			obj: { a: 10, b: Infinity, c: -Infinity },
			highest: "b",
			lowest: "c"
		},
		{ name: "NaN is skipped", obj: { a: 10, b: NaN, c: 5 }, highest: "a", lowest: "c" },
		{
			name: "null and undefined are skipped",
			obj: { a: 10, b: null, c: 5, d: 15, e: undefined },
			highest: "d",
			lowest: "c"
		},
		{
			name: "subset of keys",
			obj: { a: -10, b: 25, c: 5, d: 15, e: 100 },
			keys: ["a", "c", "d"],
			highest: "d",
			lowest: "a"
		},
		{
			name: "key order does not matter",
			obj: { a: 10, b: 25, c: 5, d: 15 },
			keys: ["c", "d", "a", "b"],
			highest: "b",
			lowest: "c"
		},
		{
			name: "non-existent key is skipped",
			obj: { a: 10, b: 25 },
			keys: ["a", "b", "nonexistent"],
			highest: "b",
			lowest: "a"
		},
		{
			name: "empty object returns first key",
			obj: {},
			keys: ["a", "b", "c"],
			highest: "a",
			lowest: "a"
		},
		{
			name: "numeric strings",
			obj: { a: "10", b: "25", c: "5", d: "15" },
			highest: "b",
			lowest: "c"
		},
		{
			name: "numbers mixed with strings",
			obj: { a: 10, b: "25", c: 5, d: "15" },
			highest: "b",
			lowest: "c"
		},
		{
			name: "decimal strings",
			obj: { a: "10.5", b: "25.7", c: "5.3", d: "15.1" },
			highest: "b",
			lowest: "c"
		},
		{
			name: "negative strings",
			obj: { a: "-10", b: "-5", c: "-15", d: "-2" },
			highest: "d",
			lowest: "c"
		},
		{
			name: "scientific notation strings",
			obj: { a: "1e2", b: "1e3", c: "1e1", d: "1e4" },
			highest: "d",
			lowest: "c"
		},
		{
			name: "strings with whitespace",
			obj: { a: " 10 ", b: "25", c: " 5", d: "15 " },
			highest: "b",
			lowest: "c"
		},
		{
			name: "non-numeric strings are skipped",
			obj: { a: "hello", b: "25", c: "world", d: "15" },
			highest: "b",
			lowest: "d"
		},
		{
			name: 'empty string is skipped but "0" is not',
			obj: { a: "", b: "25", c: "0", d: "15" },
			highest: "b",
			lowest: "c"
		},
		{
			name: "mixed valid and invalid values",
			obj: { a: "10", b: "not a number", c: "5", d: null, e: "15" },
			highest: "e",
			lowest: "c"
		},
		{
			name: "all non-numeric returns first key",
			obj: { a: "hello", b: "world", c: null, d: undefined },
			highest: "a",
			lowest: "a"
		}
	];

	test.each(cases)("$name", ({ obj, keys = Object.keys(obj), highest, lowest }) => {
		expect(robo.getExtreme(obj, keys)).toBe(highest);
		expect(robo.getExtreme(obj, keys, "highest")).toBe(highest);
		expect(robo.getExtreme(obj, keys, "max")).toBe(highest);
		expect(robo.getExtreme(obj, keys, "lowest")).toBe(lowest);
		expect(robo.getExtreme(obj, keys, "min")).toBe(lowest);
	});

	test("highestFromArray and lowestFromArray wrap getExtreme", () => {
		for (const { obj, keys = Object.keys(obj), highest, lowest } of cases) {
			expect(robo.highestFromArray(obj, keys)).toBe(highest);
			expect(robo.lowestFromArray(obj, keys)).toBe(lowest);
		}
	});

	test.each([
		{
			name: "mixed signs",
			obj: { a: -100, b: 50, c: -10, d: 75, e: -5, f: 200, g: -150 },
			highest: "f",
			lowest: "e"
		},
		{
			name: "negative has largest magnitude",
			obj: { a: -300, b: 250, c: -100 },
			highest: "a",
			lowest: "c"
		},
		{
			name: "positive has smallest magnitude",
			obj: { a: -20, b: 3, c: -15 },
			highest: "a",
			lowest: "b"
		},
		{
			name: "ties return first key",
			obj: { a: 100, b: -100, c: 50 },
			highest: "a",
			lowest: "c"
		},
		{ name: "zero", obj: { a: -10, b: 0, c: 5 }, highest: "a", lowest: "b" },
		{ name: "all negative", obj: { a: -5, b: -100, c: -2 }, highest: "b", lowest: "c" },
		{ name: "all positive", obj: { a: 5, b: 100, c: 2 }, highest: "b", lowest: "c" },
		{ name: "decimals", obj: { a: -3.7, b: 2.1, c: -1.5 }, highest: "a", lowest: "c" },
		{ name: "single key", obj: { a: -100 }, highest: "a", lowest: "a" },
		{
			name: "null, undefined, empty and non-numeric are skipped",
			obj: { a: null, b: -50, c: undefined, d: "", e: "text", f: 30 },
			highest: "b",
			lowest: "f"
		}
	])("absolute: $name", ({ obj, highest, lowest }) => {
		const keys = Object.keys(obj);
		expect(robo.getExtreme(obj, keys, "absolute_highest")).toBe(highest);
		expect(robo.getExtreme(obj, keys, "absolute_max")).toBe(highest);
		expect(robo.getExtreme(obj, keys, "absolute_lowest")).toBe(lowest);
		expect(robo.getExtreme(obj, keys, "absolute_min")).toBe(lowest);
	});

	test.each([[], "not an array", null])("throws for invalid keys: %j", (keys) => {
		const message = "Input must be a non-empty array of keys.";
		expect(() => robo.getExtreme({ a: 10 }, keys)).toThrow(message);
		expect(() => robo.getExtreme({ a: 10 }, keys, "absolute_highest")).toThrow(message);
		expect(() => robo.highestFromArray({ a: 10 }, keys)).toThrow(message);
		expect(() => robo.lowestFromArray({ a: 10 }, keys)).toThrow(message);
	});

	test.each(["invalid", "absolute_invalid"])("throws for invalid mode: %s", (mode) => {
		expect(() => robo.getExtreme({ a: 10 }, ["a"], mode)).toThrow(
			"Mode must be 'highest', 'lowest', 'max', 'min', 'absolute_highest', 'absolute_lowest', 'absolute_max', or 'absolute_min'."
		);
	});
});

describe("aAn()", () => {
	test.each([
		["apple", "an apple"],
		["hour", "an hour"],
		["European", "a European"],
		["house", "a house"]
	])("aAn(%j) is %j", (word, expected) => {
		expect(robo.aAn(word)).toBe(expected);
	});

	test("mode other than default returns only the article", () => {
		expect(robo.aAn("apple", "article")).toBe("an");
	});
});

describe("capitalise()", () => {
	test.each([
		["north west", "North west"],
		["a", "A"],
		["", ""]
	])("capitalise(%j) is %j", (str, expected) => {
		expect(robo.capitalise(str)).toBe(expected);
	});
});

describe("moreLess()", () => {
	test.each([
		[5, undefined, "more"],
		[-5, undefined, "less"],
		[0, undefined, "same"],
		[5, ["higher", "lower", "the same"], "higher"]
	])("moreLess(%s, %j) is %j", (diff, texts, expected) => {
		expect(robo.moreLess(diff, texts)).toBe(expected);
		expect(robo.moreLess(n(diff), texts)).toBe(expected);
	});
});

describe("ascending() / descending()", () => {
	test("sort numbers and MagicNumbers", () => {
		expect([3, 1, 2].sort(robo.ascending)).toEqual([1, 2, 3]);
		expect([3, 1, 2].sort(robo.descending)).toEqual([3, 2, 1]);
		expect([n(3), n(1), n(2)].sort(robo.ascending).map(Number)).toEqual([1, 2, 3]);
		expect(["b", "a"].sort(robo.ascending)).toEqual(["a", "b"]);
	});

	test.each([
		[1, 2, -1, 1],
		[2, 1, 1, -1],
		[1, 1, 0, 0],
		// Missing values come last in both directions, and are equal to each other
		[null, 1, 1, 1],
		[1, undefined, -1, -1],
		[NaN, 1, 1, 1],
		["", "a", 1, 1],
		[null, undefined, 0, 0],
		// Text comes after numbers in both directions, and before missing values
		["NA", 1, 1, 1],
		[1, "NA", -1, -1],
		["NA", null, -1, -1],
		["a", "b", -1, 1]
	])("(%s, %s)", (a, b, asc, desc) => {
		expect(robo.ascending(a, b)).toBe(asc);
		expect(robo.descending(a, b)).toBe(desc);
	});

	test("sort missing values and text after numbers, keeping the order of numbers", () => {
		const values = [5, null, 3, "NA", n(9), undefined, n(NaN), 1, "", 7];
		const show = (arr) => arr.map((v) => (v instanceof MagicNumber ? +v : v));
		expect(show([...values].sort(robo.ascending))).toEqual([
			1,
			3,
			5,
			7,
			9,
			"NA",
			null,
			NaN,
			"",
			undefined // Array.sort() always puts undefined at the end
		]);
		expect(show([...values].sort(robo.descending))).toEqual([
			9,
			7,
			5,
			3,
			1,
			"NA",
			null,
			NaN,
			"",
			undefined
		]);
	});

	test("sort dates", () => {
		const dates = [new Date(2021, 0), null, new Date(2020, 0)];
		expect(dates.sort(robo.ascending).map((d) => d?.getFullYear() ?? null)).toEqual([
			2020,
			2021,
			null
		]);
	});
});

describe("getData()", () => {
	afterEach(() => vi.unstubAllGlobals());

	test("fetches and parses a CSV into a MagicArray", async () => {
		const fetch = vi.fn(async () => ({ text: async () => "areacd,areanm,value\nE1,Foo,5" }));
		vi.stubGlobal("fetch", fetch);
		const data = await robo.getData("https://example.com/data.csv");
		expect(fetch).toHaveBeenCalledWith("https://example.com/data.csv");
		expect(data).toBeInstanceOf(MagicArray);
		expect(data.get("Foo").value).toBeInstanceOf(MagicNumber);
	});
});

describe("pluralise() / singularise()", () => {
	test("pluralise('person') should return 'people'", () => {
		expect(robo.pluralise("person")).toBe("people");
	});

	test("pluralise('person', 1) should return 'person'", () => {
		expect(robo.pluralise("person", 1)).toBe("person");
	});

	test("pluralise('people', 1) should return 'person'", () => {
		expect(robo.pluralise("people", 1)).toBe("person");
	});

	test("singularise('people') should return 'person'", () => {
		expect(robo.singularise("people")).toBe("person");
	});
});

// Values as parsed from a CSV (MagicNumber), as templates receive them
const n = (value) => robo.csvParse(`v\n${value}`)[0].v;

describe("describeChange()", () => {
	test.each([
		[100, 105.2, {}, "increased by 5.2%"],
		[100, 94, {}, "decreased by 6.0%"],
		[100, 100, {}, "was unchanged"],
		[100, 100.01, {}, "was unchanged"], // rounds to 0.0%
		[0, 5, {}, "increased"], // percentage change from zero is undefined
		[1000, 2200, { type: "absolute" }, "increased by 1,200"],
		[21.3, 22.3, { type: "pp" }, "increased by 1.0 percentage point"],
		[21.3, 24.8, { type: "pp" }, "increased by 3.5 percentage points"],
		[100, 112.34, { str: ".0f" }, "increased by 12%"],
		[100, 100.5, { threshold: 1 }, "was unchanged"],
		[100, 90, { texts: ["rose", "fell", "was flat"] }, "fell by 10.0%"]
	])("describeChange(%s, %s, %j) is %j", (from, to, options, expected) => {
		expect(robo.describeChange(n(from), n(to), options)).toBe(expected);
		expect(robo.describeChange(from, to, options)).toBe(expected);
	});

	test("returns an empty string for missing values", () => {
		expect(robo.describeChange(null, n(5))).toBe("");
		expect(robo.describeChange(n(5), n("NaN"))).toBe("");
	});

	test("is available as a MagicNumber method", () => {
		expect(n(100).describeChange(n(110))).toBe("increased by 10.0%");
	});
});

describe("approx()", () => {
	test.each([
		[5.97, 2, "almost 6"],
		[6, 2, "6"],
		[1234, 2, "just over 1,200"],
		[99999, 2, "almost 100,000"],
		[1030000, 2, "just over 1 million"],
		[1520000000, 2, "just over 1.5 billion"],
		[46, 1, "around 50"],
		[48.2, 1, "almost 50"],
		[0.0123, 2, "just over 0.012"],
		[0, 2, "0"]
	])("approx(%s, %s) is %j", (value, sf, expected) => {
		expect(robo.approx(n(value), sf)).toBe(expected);
		expect(n(value).approx(sf)).toBe(expected);
	});

	test("hedge words and threshold can be changed", () => {
		const options = { texts: ["just under", "about", "just over"], threshold: 0.001 };
		expect(robo.approx(5.97, 2, options)).toBe("about 6");
		expect(robo.approx(5.999, 2, options)).toBe("just under 6");
	});
});

describe("toFraction()", () => {
	test.each([
		[0.21, "one in five", "a fifth"],
		[0.5, "one in two", "half"],
		[0.45, "one in two", "half"], // ties go to the simpler fraction
		[0.33, "one in three", "a third"],
		[0.66, "two in three", "two-thirds"],
		[0.4, "two in five", "two-fifths"],
		[0.75, "three in four", "three-quarters"],
		[0.7, "seven in 10", "seven-tenths"],
		[0.05, "one in 20", "one in 20"] // small proportions are always "one in x"
	])("toFraction(%s) is %j or %j", (value, inWords, fraction) => {
		expect(robo.toFraction(n(value))).toBe(inWords);
		expect(robo.toFraction(n(value), "fraction")).toBe(fraction);
		expect(n(value).toFraction("fraction")).toBe(fraction);
	});

	test("custom denominators", () => {
		expect(robo.toFraction(0.45, "in", [2, 3, 4, 5, 9, 10])).toBe("four in nine");
	});

	test.each([0, 1, -0.5, 1.5, null])("returns an empty string for %s", (value) => {
		expect(robo.toFraction(value)).toBe("");
	});
});

describe("describeRank()", () => {
	test.each([
		[1, false, "the highest"],
		[1, true, "the joint highest"],
		[2, false, "the second highest"],
		[3, true, "the joint third highest"],
		[12, false, "the 12th highest"]
	])("describeRank(%s, 'highest', %s) is %j", (rank, tied, expected) => {
		expect(robo.describeRank(n(rank), "highest", tied)).toBe(expected);
	});

	test("custom label", () => {
		expect(robo.describeRank(2, "largest")).toBe("the second largest");
	});
});

describe("formatDate()", () => {
	test.each([
		[n("2024-03-04"), "day", "4 March 2024"],
		["2024-03-04", "month", "March 2024"],
		[new Date(Date.UTC(2024, 2, 4)), "year", "2024"],
		[n(2019), "year", "2019"], // a year column is parsed as a number
		[n(2019), "day", "1 January 2019"]
	])("formatDate(%s, %j) is %j", (date, unit, expected) => {
		expect(robo.formatDate(date, unit)).toBe(expected);
	});

	test("throws for an invalid unit", () => {
		expect(() => robo.formatDate("2024-03-04", "week")).toThrow(
			"Unit must be 'day', 'month' or 'year'."
		);
	});
});

describe("formatPeriod()", () => {
	test.each([
		[n(2010), n(2020), "year", "2010 to 2020"],
		[2020, 2020, "year", "2020"],
		["2024-01-01", "2024-03-01", "month", "January to March 2024"],
		["2023-12-01", "2024-02-01", "month", "December 2023 to February 2024"],
		["2024-03-04", "2024-03-15", "day", "4 to 15 March 2024"],
		["2024-03-04", "2024-06-15", "day", "4 March to 15 June 2024"],
		["2023-12-30", "2024-01-02", "day", "30 December 2023 to 2 January 2024"]
	])("formatPeriod(%s, %s, %j) is %j", (start, end, unit, expected) => {
		expect(robo.formatPeriod(start, end, unit)).toBe(expected);
	});
});

describe("compareTo()", () => {
	test.each([
		[105, 100, {}, "higher than"],
		[100, 100, {}, "the same as"],
		[95, 100, {}, "lower than"],
		[103, 100, { threshold: 0.05 }, "the same as"],
		[106, 100, { threshold: 0.05 }, "higher than"],
		[1, 0, {}, "higher than"],
		[97, 100, { threshold: 0.05, texts: ["above", "similar to", "below"] }, "similar to"]
	])("compareTo(%s, %s, %j) is %j", (value, ref, options, expected) => {
		expect(robo.compareTo(n(value), n(ref), options)).toBe(expected);
		expect(n(value).compareTo(n(ref), options)).toBe(expected);
	});
});
