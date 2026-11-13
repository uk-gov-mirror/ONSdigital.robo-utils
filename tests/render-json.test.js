import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import pug from "pug";
import renderJSON from "../src/render-json.js";
import MagicArray from "../src/magic-array.js";
import { csvParse } from "../src/functions.js";

const csv = `areacd,areanm,parentcd,value
E06000001,Hartlepool,E12000001,5
E06000002,Middlesbrough,E12000001,7
E12000001,North East,E92000001,12
E92000001,England,,100`;
const places = MagicArray.from(csvParse(csv));
const place = places.get("Hartlepool");

const render = (template, p = place) => renderJSON(template, p, places, places.lookup, pug);
const section = (template) => render(template).sections[0];

let warn;
beforeEach(() => {
	warn = vi.spyOn(console, "warn").mockImplementation(() => {});
});
afterEach(() => {
	warn.mockRestore();
});

describe("sections", () => {
	test("each top-level section becomes an object with id, type and content", () => {
		const result = render(
			"section#intro.text\n  h2 Title\n  p Hello #{place.getName()}\nsection#two\n  p Two"
		);
		expect(result.sections).toEqual([
			{ id: "intro", type: "text", content: "<h2>Title</h2><p>Hello Hartlepool</p>" },
			{ id: "two", content: "<p>Two</p>" }
		]);
		expect(result.error).toBeUndefined();
	});

	test("text directly inside a section is kept", () => {
		expect(section("section\n  | Some text\n  p A")).toEqual({ content: "Some text<p>A</p>" });
	});

	test("a template without sections becomes a single section", () => {
		expect(render("p Hello\np World").sections).toEqual([
			{ content: "<p>Hello</p><p>World</p>" }
		]);
	});

	test("nested sections become sub-sections", () => {
		expect(
			section("section#scroller.scroller\n  section#s1\n    p One\n  section#s2\n    p Two")
		).toEqual({
			id: "scroller",
			type: "scroller",
			sections: [
				{ id: "s1", content: "<p>One</p>" },
				{ id: "s2", content: "<p>Two</p>" }
			]
		});
	});
});

describe("props", () => {
	test("props become fields, keeping inner HTML", () => {
		expect(section("section\n  prop.title My #[strong title]\n  p Body")).toEqual({
			title: "My <strong>title</strong>",
			content: "<p>Body</p>"
		});
	});

	test("|-separated props become arrays", () => {
		expect(section("section\n  prop.years 2020|2021").years).toEqual(["2020", "2021"]);
	});

	test("|-separated props are unescaped", () => {
		expect(section('section\n  prop.labels= "A & B|<C>"').labels).toEqual(["A & B", "<C>"]);
	});
});

describe("prop.data and toData()", () => {
	const expected = [
		{ x: 5, y: "Hartlepool" },
		{ x: 7, y: "Middlesbrough" },
		{ x: 12, y: "North East" },
		{ x: 100, y: "England" }
	];

	test.each([
		[
			"at the end of a line",
			'section\n  prop.data= places.toData({x: "value", y: "areanm"})\n  p A\n'
		],
		[
			"with CRLF line endings",
			'section\r\n  prop.data= places.toData({x: "value", y: "areanm"})\r\n  p A\r\n'
		],
		[
			"at the end of the file",
			'section\n  prop.data= places.toData({x: "value", y: "areanm"})'
		],
		[
			"with trailing whitespace",
			'section\n  prop.data= places.toData({x: "value", y: "areanm"})  \n  p A\n'
		],
		[
			"with props in a variable",
			'- var props = {x: "value", y: "areanm"}\nsection\n  prop.data= places.toData(props)\n  p= Object.keys(props).join()\n'
		],
		[
			"with an explicit stringify mode",
			'section\n  prop.data= places.toData({x: "value", y: "areanm"}, "stringify")\n'
		]
	])("is parsed as JSON %s", (_, template) => {
		const result = render(template);
		expect(result.error).toBeUndefined();
		expect(result.sections[0].data).toEqual(expected);
	});

	test("works after chained MagicArray methods", () => {
		expect(
			section(
				'section\n  prop.data= places.filterBy("parentcd", "E12000001").toData({x: "value", y: "areanm"})\n'
			).data
		).toEqual(expected.slice(0, 2));
	});

	test("toData() can be iterated as an array inside the template", () => {
		expect(
			section('section\n  each d in places.toData({y: "areanm"})\n    p= d.y').content
		).toBe("<p>Hartlepool</p><p>Middlesbrough</p><p>North East</p><p>England</p>");
	});

	test("does not alter strings containing digits and spaces", () => {
		const template =
			'- var rows = MagicArray.from([{areacd: "E1", areanm: "Top 10 2020", v: 1}])\nsection\n  prop.data= rows.toData({y: "areanm"})\n';
		expect(section(template).data).toEqual([{ y: "Top 10 2020" }]);
	});

	test("unescapes quotes, ampersands and angle brackets", () => {
		const template =
			'- var rows = MagicArray.from([{areacd: "E1", areanm: "A & B\'s \\"<best>\\"", v: 1}])\nsection\n  prop.data= rows.toData({y: "areanm"})\n';
		expect(section(template).data).toEqual([{ y: 'A & B\'s "<best>"' }]);
	});

	test("invalid JSON is reported in error", () => {
		const result = render("section\n  prop.data not json\n");
		expect(result.error).toMatch(/JSON/);
		expect(warn).toHaveBeenCalled();
	});
});

describe("<mark> text colour", () => {
	test("adds black or white text for contrast with the background", () => {
		expect(
			section(
				'section\n  p #[mark(style="background-color: #206095") dark] #[mark(style="background-color: #ffffff") light]'
			).content
		).toBe(
			'<p><mark style="background-color: #206095; color: white;">dark</mark> <mark style="background-color: #ffffff; color: black;">light</mark></p>'
		);
	});

	test("handles no space after the colon", () => {
		expect(section('section\n  p #[mark(style="background-color:#ffffff") a]').content).toBe(
			'<p><mark style="background-color:#ffffff; color: black;">a</mark></p>'
		);
	});

	test("handles other styles after the background colour", () => {
		expect(
			section('section\n  p #[mark(style="background-color: #206095; font-weight: bold") a]')
				.content
		).toBe(
			'<p><mark style="background-color: #206095; color: white; font-weight: bold">a</mark></p>'
		);
	});

	test("applies inside props too", () => {
		expect(
			section('section\n  prop.title #[mark(style="background-color: #ffffff") a]').title
		).toBe('<mark style="background-color: #ffffff; color: black;">a</mark>');
	});

	test("leaves an explicit text colour alone", () => {
		const content = section(
			'section\n  p #[mark(style="background-color: #206095; color: red") a]'
		).content;
		expect(content).toBe('<p><mark style="background-color: #206095; color: red">a</mark></p>');
	});

	test("skips colours it cannot parse, without an error", () => {
		const result = render('section\n  p #[mark(style="background-color: var(--x)") a]');
		expect(result.error).toBeUndefined();
		expect(result.sections[0].content).toBe(
			'<p><mark style="background-color: var(--x)">a</mark></p>'
		);
	});
});

describe("content", () => {
	test("keeps Pug's spacing and text unchanged", () => {
		const text = "5 % and 4 pp and £ 10, #[strong 6]. #[em 7]§ and #[b 8] more";
		expect(section(`section\n  p ${text}`).content).toBe(
			"<p>5 % and 4 pp and £ 10, <strong>6</strong>. <em>7</em>§ and <b>8</b> more</p>"
		);
	});
});

describe("notes", () => {
	test("top-level HTML comments become notes", () => {
		const result = render("// Version 2024-01-01\n//- Pug-only comment\nsection\n  p A");
		expect(result.notes).toEqual(["Version 2024-01-01"]);
		expect(result.sections).toEqual([{ content: "<p>A</p>" }]);
	});

	test("comments inside sections are dropped from content", () => {
		expect(section("section\n  // inner\n  p A")).toEqual({ content: "<p>A</p>" });
	});

	test("no notes key without comments", () => {
		expect(render("section\n  p A")).not.toHaveProperty("notes");
	});
});

describe("place, region and country", () => {
	test("adds the place and looks up its region and country", () => {
		const result = render("section\n  p A");
		expect(result.place).toBe(place);
		expect(result.region).toBe(places.get("North East"));
		expect(result.ctry).toBe(places.get("England"));
	});

	test("no place, region or country when place is null", () => {
		const result = render("section\n  p A", null);
		expect(Object.keys(result)).toEqual(["sections"]);
	});

	test("works with a plain object place and no lookup", () => {
		const plain = { areacd: "E06000001", areanm: "Hartlepool", parentcd: "E12000001" };
		const result = renderJSON("section\n  p= nonexistent.foo", plain, places, null, pug);
		expect(result.place).toBe(plain);
		expect(result.error).toMatch(/reading 'foo'/);
	});
});

describe("errors", () => {
	test.each([
		["a place", place],
		["no place", null]
	])("Pug errors are returned in error with %s", (_, p) => {
		const result = render("section\n  p= nonexistent.foo", p);
		expect(result.sections).toEqual([]);
		expect(result.error).toMatch(/Cannot read properties of undefined \(reading 'foo'\)/);
		expect(warn).toHaveBeenCalledOnce();
	});

	test("Pug errors are returned for a place with no name, which is named by its code", () => {
		const noName = MagicArray.from(csvParse("areacd,areanm,value\nE06000099,,5"))[0];
		const result = render("section\n  p= nonexistent.foo", noName);
		expect(result.error).toMatch(/reading 'foo'/);
		expect(warn.mock.calls[0][0]).toBe("PUG error. No HTML generated for E06000099");
	});
});
