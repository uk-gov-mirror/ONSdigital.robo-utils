import { describe, expect, test } from "vitest";
import MagicArray from "../src/magic-array.js";
import MagicNumber from "../src/magic-number.js";
import { csvParse } from "../src/functions.js";
import { places, names } from "./setup.js";

// Values with missing cells, text ("NA") and ties: 9 (E, H), 7, 5, 3, 1, then NA and two nulls
const messy = MagicArray.from(
	csvParse("areacd,areanm,v\nA,A,5\nB,B,\nC,C,3\nD,D,NA\nE,E,9\nF,F,\nG,G,1\nH,H,9\nI,I,7")
);

describe("MagicArray.get() and lookup", () => {
	const leeds = places.get("Leeds");

	test.each([
		["MagicArray.from", () => MagicArray.from(places)],
		["new MagicArray", () => new MagicArray(...places.trim(5), leeds)],
		[".filter()", () => places.filter((d) => d.areanm.startsWith("L"))],
		[".slice()", () => places.slice()],
		["filterBy", () => places.filterBy("areanm", "Leeds")],
		["remove", () => places.remove(places.get("Rutland"))],
		["top", () => places.top("population_2011", 3)],
		["bottom", () => places.bottom("population_2011", 400)],
		["trim", () => places.sortBy("population_2011", "descending").trim(2)],
		["add", () => places.trim(1).add(leeds)]
	])("works on arrays from %s", (_, make) => {
		const arr = make();
		expect(arr.get("Leeds")).toBe(leeds);
		expect(arr.get(leeds.areacd)).toBe(leeds);
		expect(arr.lookup.Leeds).toBe(leeds);
	});

	test("detects column keys from the first row", () => {
		const arr = places.filter(() => true);
		expect([arr.codeKey, arr.nameKey, arr.parentKey]).toEqual(["areacd", "areanm", "parentcd"]);
	});

	test("updates after items are added or removed in place", () => {
		const arr = places.trim(1);
		expect(arr.get("Leeds")).toBeUndefined();
		arr.push(leeds);
		expect(arr.get("Leeds")).toBe(leeds);
		arr.pop();
		expect(arr.get("Leeds")).toBeUndefined();
	});

	test("refreshProps() rebuilds after items are replaced in place", () => {
		const arr = places.trim(1);
		arr[0] = leeds;
		arr.refreshProps();
		expect(arr.get("Leeds")).toBe(leeds);
	});

	test("codeKey and parentKey can be set", () => {
		const arr = places.trim(2);
		arr.codeKey = "areanm";
		arr.nameKey = "areanm";
		expect(arr.get(arr[0].areacd)).toBeUndefined();
		expect(arr.get(arr[0].areanm)).toBe(arr[0]);
		arr.parentKey = "areacd";
		expect(arr.parentKey).toBe("areacd");
	});

	test("lookup and column keys can still be set", () => {
		const arr = places.trim(2);
		arr.lookup = { custom: leeds };
		expect(arr.get("custom")).toBe(leeds);
		arr.nameKey = "areacd";
		expect(arr.get("Leeds")).toBeUndefined();
		expect(arr.get(arr[0].areacd)).toBe(arr[0]);
	});

	test("lookup and column keys are not enumerable", () => {
		expect(Object.keys(places.trim(2))).toEqual(["0", "1"]);
	});

	test("empty arrays have an empty lookup", () => {
		expect(new MagicArray().get("Leeds")).toBeUndefined();
		expect(new MagicArray().codeKey).toBeUndefined();
	});
});

describe("MagicArray.columns", () => {
	const csv = "2019,areacd,areanm\n5,E1,Hull\n7,E2,Leeds";
	const parsed = csvParse(csv);
	const arr = MagicArray.from(parsed);

	test("copied from a csvParse() array, in its order", () => {
		expect(arr.columns).toEqual(["2019", "areacd", "areanm"]);
		expect(arr.columns).not.toBe(parsed.columns);

		// Object.keys() would put number-like names first
		const reordered = MagicArray.from(csvParse("areacd,2019\nE1,5")).filter(() => true);
		expect(Object.keys(reordered[0])).toEqual(["2019", "areacd"]);
		expect(reordered.columns).toEqual(["areacd", "2019"]);
	});

	test("kept by methods and built-in methods that return rows", () => {
		const parsed = csvParse("areacd,areanm,v,2019\nE1,Hull,5,1\nE2,Leeds,7,2\nE3,York,,3");
		const arr = MagicArray.from(parsed);
		const columns = ["areacd", "areanm", "v", "2019"];
		for (const result of [
			arr.filter(() => true),
			arr.slice(1),
			arr.concat([]),
			MagicArray.from(arr),
			arr.sortBy("v"),
			arr.filterBy("areanm", "Hull"),
			arr.top("v", 2),
			arr.between("v", 1, 2),
			arr.trim(1),
			arr.flip(),
			arr.add(arr[0]),
			arr.remove(arr[0])
		])
			expect(result.columns).toEqual(columns);
		expect(places.columns.slice(0, 3)).toEqual(["areacd", "areanm", "parentcd"]);
	});

	test("otherwise the keys of the first row", () => {
		const rows = [
			{ a: 1, b: 2 },
			{ a: 3, c: 4 }
		];
		expect(MagicArray.from(rows).columns).toEqual(["a", "b"]);
		expect(new MagicArray(...rows).columns).toEqual(["a", "b"]);
		expect(arr.map((d) => ({ x: d.areanm })).columns).toEqual(["x"]);
		expect(MagicArray.from(arr, (d) => ({ x: d.areanm })).columns).toEqual(["x"]);
		expect(new MagicArray().columns).toEqual([]);
		expect(MagicArray.from([1, 2]).columns).toEqual([]);
	});

	test("can be set, and isn't cleared by refreshProps()", () => {
		const copy = MagicArray.from(arr);
		copy.columns = ["areanm"];
		copy.refreshProps();
		expect(copy.columns).toEqual(["areanm"]);
		expect(arr.columns).toEqual(["2019", "areacd", "areanm"]);
		copy.columns = null;
		expect(copy.columns).toEqual(Object.keys(copy[0]));
	});

	test("is not enumerable", () => {
		expect(Object.keys(arr)).toEqual(["0", "1"]);
		expect(JSON.stringify(arr.trim(1))).not.toContain("columns");
	});
});

describe("MagicArray.top() / bottom() / remove()", () => {
	test("top two places by population plus Rutland", () => {
		expect([...places.top("population_2011", 2, places.get("Rutland"))]).toEqual([
			places.get("Birmingham"),
			places.get("Leeds"),
			places.get("Rutland")
		]);
	});

	test("bottom two places by population plus Rutland", () => {
		expect([...places.bottom("population_2011", 2, places.get("Rutland"))]).toEqual([
			places.get("Rutland"),
			places.get("City of London"),
			places.get("Isles of Scilly")
		]);
	});

	test("bottom three places by population minus Isles of Scilly", () => {
		expect([
			...places.bottom("population_2011", 3).remove(places.get("Isles of Scilly"))
		]).toEqual([places.get("West Somerset"), places.get("City of London")]);
	});

	test("leave out missing values and text", () => {
		expect(names(messy.top("v", 3))).toEqual(["E", "H", "I"]);
		expect(names(messy.bottom("v", 3))).toEqual(["A", "C", "G"]);
		expect(messy.bottom("v").areanm).toBe("G");
		expect(names(messy.top("v", 20))).toEqual(["E", "H", "I", "A", "C", "G"]);
	});

	test("added rows with missing values go at the end", () => {
		expect(names(messy.top("v", 2, messy.get("B")))).toEqual(["E", "H", "B"]);
		expect(names(messy.bottom("v", 1, messy.get("D")))).toEqual(["G", "D"]);
	});

	test("ties = true includes rows tied with the last one, and always returns an array", () => {
		expect(messy.top("v").areanm).toBe("E");
		expect(names(messy.top("v", 1, null, true))).toEqual(["E", "H"]);
		expect(names(messy.top("v", 2, null, true))).toEqual(["E", "H"]);
		expect(names(messy.top("v", 3, null, true))).toEqual(["E", "H", "I"]);
		expect(names(messy.bottom("v", 1, null, true))).toEqual(["G"]);
		expect(names(messy.bottom("v", 5, null, true))).toEqual(["E", "H", "I", "A", "C", "G"]);

		const tied = MagicArray.from(
			csvParse("areacd,areanm,v\nE1,A,40\nE2,B,30\nE3,C,30\nE4,D,10")
		);
		expect(names(tied.top("v", 2, null, true))).toEqual(["A", "B", "C"]);
		expect(names(tied.bottom("v", 2, null, true))).toEqual(["B", "C", "D"]);
		expect(names(tied.top("v", 2, tied.get("D"), true))).toEqual(["A", "B", "C", "D"]);
	});

	test("ties = true agrees with getRank()", () => {
		for (const n of [1, 2, 3, 4]) {
			const top = messy.top("v", n, null, true);
			const nth = messy.descending("v")[n - 1];
			expect(top.every((d) => messy.getRank(d, "v") <= messy.getRank(nth, "v"))).toBe(true);
		}
	});

	test("columns with only missing values or only text", () => {
		const text = MagicArray.from(csvParse("areacd,areanm,v,w\nE1,A,b,\nE2,B,c,\nE3,C,a,"));
		expect(text.top("v").areanm).toBe("B");
		expect(text.top("w", 2)).toEqual([]);
	});
});

describe("MagicArray.filterBy()", () => {
	test("matches string values", () => {
		expect(names(places.filterBy("areanm", "Rutland"))).toEqual(["Rutland"]);
	});

	test("matches numeric (MagicNumber) values against plain numbers", () => {
		const pop = places.get("Rutland").population_2011;
		expect(names(places.filterBy("population_2011", pop.valueOf()))).toEqual(["Rutland"]);
		expect(names(places.filterBy("population_2011", pop))).toEqual(["Rutland"]);
	});

	test("returns an empty array when nothing matches", () => {
		expect(places.filterBy("areanm", "Atlantis").length).toBe(0);
	});
});

describe("MagicArray.sortBy() / ascending() / descending() / flip()", () => {
	const top3 = ["Birmingham", "Leeds", "Sheffield"];

	test("sort by a column, returning a copy", () => {
		expect(names(places.descending("population_2011").trim(3))).toEqual(top3);
		expect(names(places.sortBy("population_2011", "descending").trim(3))).toEqual(top3);
		expect(names(places.ascending("population_2011").trim(-3).flip())).toEqual(top3);
		expect(names(places.sortBy("population_2011").trim(1))).toEqual(["Isles of Scilly"]);
		expect(places[0].areanm).toBe("Adur"); // original order is unchanged
	});

	test("flip() reverses a copy", () => {
		const arr = places.trim(3);
		expect(names(arr.flip())).toEqual(names(arr).reverse());
		expect(names(arr)).toEqual(["Adur", "Allerdale", "Amber Valley"]);
	});

	test("missing values and text go last in either order", () => {
		const show = (arr) => arr.map((d) => (d.v === null ? null : d.v.valueOf()));
		expect(show(messy.descending("v"))).toEqual([9, 9, 7, 5, 3, 1, "NA", null, null]);
		expect(show(messy.ascending("v"))).toEqual([1, 3, 5, 7, 9, 9, "NA", null, null]);
		expect(names(messy.descending("v").trim(2))).toEqual(["E", "H"]); // ties keep their order
	});
});

describe("MagicArray.getRank()", () => {
	// B and C are tied on 20
	const rows = MagicArray.from(
		csvParse("areacd,areanm,v\nE1,A,10\nE2,B,20\nE3,C,20\nE4,D,5\nE5,E,")
	);

	test.each([
		["A", 3, [], "the third highest"], // two places are higher
		["B", 1, ["E3"], "the joint highest"],
		["C", 1, ["E2"], "the joint highest"],
		["D", 4, [], "the fourth highest"]
	])("%s is ranked %i, tied with %j", (name, rank, ties, text) => {
		const result = rows.getRank(rows.get(name), "v");
		expect(result).toBeInstanceOf(MagicNumber);
		expect(+result).toBe(rank);
		expect(result.isTied).toBe(ties.length > 0);
		expect(result.ties).toEqual(ties);
		expect(result.describe()).toBe(text);
	});

	test("ascending order with a custom label", () => {
		const result = rows.getRank(rows.get("B"), "v", "ascending");
		expect([+result, result.isTied, result.ties]).toEqual([3, true, ["E3"]]);
		expect(result.describe("smallest")).toBe("the joint third smallest");
		expect(rows.getRank(rows.get("D"), "v", "ascending").describe("smallest")).toBe(
			"the smallest"
		);
	});

	test("can be used like a number", () => {
		const result = rows.getRank(rows.get("A"), "v");
		expect(result.toWords("ordinal")).toBe("third");
		expect(result + 1).toBe(4);
		expect(result > 2).toBe(true);
		expect(JSON.stringify({ rank: result })).toBe('{"rank":3}');
	});

	test("works with the census data", () => {
		const birmingham = places.getRank(places.get("Birmingham"), "population_2011");
		expect(birmingham.toWords("ordinal")).toBe("first");
		expect(birmingham.toWords("ordinal", { dropFirst: true })).toBe("");
		expect(places.getRank(places.get("Leeds"), "population_2011").describe("largest")).toBe(
			"the second largest"
		);
	});

	test("works with plain (non-MagicNumber) values", () => {
		const plain = MagicArray.from([
			{ areacd: "E1", v: 10 },
			{ areacd: "E2", v: 20 },
			{ areacd: "E3", v: 20 }
		]);
		expect(plain.map((d) => +plain.getRank(d, "v"))).toEqual([3, 1, 1]);
	});

	test("is null for missing values and text, which don't affect other ranks", () => {
		expect(messy.getRank(messy.get("B"), "v")).toBeNull();
		expect(messy.getRank(messy.get("D"), "v")).toBeNull();
		expect(messy.map((d) => messy.getRank(d, "v")?.valueOf() ?? null)).toEqual([
			4,
			null,
			5,
			null,
			1,
			null,
			6,
			1,
			3
		]);
		expect(+messy.getRank(messy.get("G"), "v", "ascending")).toBe(1);
		expect(messy.getRank(messy.get("H"), "v").ties).toEqual(["E"]);
	});
});

describe("MagicArray.toList()", () => {
	test("joins a column into a list", () => {
		const top3 = places.top("population_2011", 3);
		expect(top3.toList("areanm")).toBe("Birmingham, Leeds and Sheffield");
		expect(top3.toList("areanm", [", ", " or "])).toBe("Birmingham, Leeds or Sheffield");
		expect(top3.toList((d) => d.areacd)).toBe("E08000025, E08000035 and E08000019");
	});
});

describe("MagicArray.toData()", () => {
	test("top 3 places by population to data", () => {
		expect(
			places.top("population_2011", 3).toData({ x: "population_2011", y: "areanm" })
		).toEqual(
			["Birmingham", "Leeds", "Sheffield"].map((nm) => ({
				x: places.get(nm).population_2011,
				y: nm
			}))
		);
	});
});

describe("MagicArray.between()", () => {
	const key = "population_2011";
	const rutland = places.get("Rutland");
	const birmingham = places.get("Birmingham");
	const smallest = places.get("Isles of Scilly");
	// Ranked 100th by population, between Hammersmith and Fulham (99th) and New Forest (101st)
	const caerphilly = places.get("Caerphilly");

	describe("rank mode", () => {
		test.each([
			{ start: 2, end: 4, expected: ["Leeds", "Sheffield", "Cornwall"] },
			{ start: 1, end: 1, expected: ["Birmingham"] }
		])("ranks $start to $end", ({ start, end, expected }) => {
			const result = places.between(key, start, end);
			expect(result).toBeInstanceOf(MagicArray); // A single result is still an array
			expect(names(result)).toEqual(expected);
		});

		test("added item is merged in sorted position", () => {
			expect(names(places.between(key, 1, 3, "rank", "descending", rutland))).toEqual([
				"Birmingham",
				"Leeds",
				"Sheffield",
				"Rutland"
			]);
		});

		test("ascending order ranks from the smallest", () => {
			expect(names(places.between(key, 1, 5, "rank", "ascending"))).toEqual([
				"Isles of Scilly",
				"City of London",
				"West Somerset",
				"Rutland",
				"Purbeck"
			]);
		});
	});

	describe("value mode", () => {
		test("returns every place within the range, in either argument order", () => {
			const result = places.between(key, 100000, 500000, "value");
			const expected = places.filter((d) => d[key] >= 100000 && d[key] <= 500000);
			expect(result.length).toBe(expected.length);
			expect(names(result)).toEqual(names(expected.sortBy(key, "descending")));
			expect(places.between(key, 500000, 100000, "value")).toEqual(result);
		});

		test("added item is not duplicated when already in range", () => {
			const pop = rutland.population_2011;
			expect(
				names(places.between(key, pop - 1000, pop + 1000, "value", "descending", rutland))
			).toEqual(["Rutland"]);
		});

		test("added item is included when outside range", () => {
			const pop = rutland.population_2011;
			const result = places.between(
				key,
				pop + 10000,
				pop + 20000,
				"value",
				"descending",
				rutland
			);
			expect(result.length).toBe(10);
			expect(result.at(-1)).toBe(rutland);
		});
	});

	describe("around mode", () => {
		test.each([
			{
				label: "largest place",
				target: birmingham,
				range: 2,
				included: ["Birmingham", "Leeds", "Sheffield"]
			},
			{
				label: "smallest place",
				target: smallest,
				range: 2,
				included: ["West Somerset", "City of London", "Isles of Scilly"]
			},
			{
				label: "middle place",
				target: caerphilly,
				range: 1,
				included: ["Hammersmith and Fulham", "Caerphilly", "New Forest"]
			},
			{ label: "range 0", target: caerphilly, range: 0, included: ["Caerphilly"] }
		])("$label, range $range, with and without target", ({ target, range, included }) => {
			const withTarget = places.between(key, target, range, "around");
			const withoutTarget = places.between(
				key,
				target,
				range,
				"around",
				"descending",
				null,
				true
			);
			expect(names(withTarget)).toEqual(included);
			expect(names(withoutTarget)).toEqual(included.filter((nm) => nm !== target.areanm));
		});

		test("uses the target's position, not its (shared) rank, when values are tied", () => {
			const tied = MagicArray.from(
				csvParse("areacd,areanm,v\nE1,A,40\nE2,B,30\nE3,C,30\nE4,D,30\nE5,E,10")
			);
			expect(names(tied.between("v", tied.get("D"), 1, "around"))).toEqual(["C", "D", "E"]);
			expect(names(tied.between("v", tied.get("B"), 1, "around"))).toEqual(["A", "B", "C"]);
		});

		test("excludeTarget matches removing the target afterwards", () => {
			expect(
				names(places.between(key, birmingham, 2, "around", "descending", null, true))
			).toEqual(names(places.between(key, birmingham, 2, "around").remove(birmingham)));
		});

		test("excludeTarget defaults to false", () => {
			expect(places.between(key, caerphilly, 2, "around")).toEqual(
				places.between(key, caerphilly, 2, "around", "descending", null, false)
			);
		});

		test("added item is merged in and target excluded", () => {
			expect(
				names(places.between(key, caerphilly, 1, "around", "descending", rutland, true))
			).toEqual(["Hammersmith and Fulham", "New Forest", "Rutland"]);
		});

		test("ascending order with excludeTarget", () => {
			expect(
				names(places.between(key, caerphilly, 1, "around", "ascending", null, true))
			).toEqual(["New Forest", "Hammersmith and Fulham"]);
		});

		test("single-item array with excludeTarget returns empty", () => {
			const single = MagicArray.from([places[0]]);
			expect(
				single.between(key, places[0], 1, "around", "descending", null, true).length
			).toBe(0);
		});
	});

	test("excludeTarget has no effect in rank and value modes", () => {
		expect(places.between(key, 1, 3, "rank", "descending", null, true)).toEqual(
			places.between(key, 1, 3, "rank", "descending", null, false)
		);
		expect(places.between(key, 100000, 500000, "value", "descending", null, true)).toEqual(
			places.between(key, 100000, 500000, "value", "descending", null, false)
		);
	});

	test("invalid mode throws", () => {
		expect(() => places.between(key, 1, 5, "invalid")).toThrow(
			"Invalid mode: invalid. Use 'rank', 'value', or 'around'."
		);
	});

	test("leaves out missing values and text", () => {
		expect(names(messy.between("v", 1, 3))).toEqual(["E", "H", "I"]);
		expect(names(messy.between("v", 5, 9, "rank"))).toEqual(["C", "G"]);
		expect(names(messy.between("v", 0, 4, "value"))).toEqual(["C", "G"]);
		expect(names(messy.between("v", messy.get("G"), 2, "around"))).toEqual(["A", "C", "G"]);
	});
});
