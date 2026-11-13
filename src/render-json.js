import * as parser from "node-html-parser";
import parseColor from "parse-color";
import * as functions from "./functions.js";
import MagicArray from "./magic-array.js";

const parse = parser?.default?.parse ? parser.default.parse : parser?.parse ? parser.parse : parser;

const COMMENT_NODE = 8;

// Add a black or white text colour to <mark> tags for contrast with their background colour
function setMarkColor(mark) {
	const style = mark.getAttribute("style");
	const background = style?.match(/background-color:\s*([^;]+)/)?.[1].trim();
	if (!background || /(^|[;\s])color\s*:/.test(style)) return;
	const rgb = parseColor(background).rgb;
	if (!rgb) return;
	const color = (rgb[0] * 299 + rgb[1] * 587 + rgb[2] * 114) / 1000 > 125 ? "black" : "white";
	const newStyle = style.replace(
		/background-color:\s*[^;]+;?/,
		(match) => `${match.replace(/;$/, "")}; color: ${color};`
	);
	mark.setAttribute("style", newStyle);
}

// Cycle through LAs (and null for "no area selected")
export default function renderJSON(template, place, places, lookup, pug = window.pug) {
	// Arrays to hold content
	const sections = [];
	const notes = [];

	// Error message for invalid outputs (where pug renderer has thrown an error)
	let error;

	try {
		// Render PUG template with data for selected LA
		// (arrays returned by .toData() serialise themselves to JSON when output)
		let sections_raw = pug.render(template, {
			place,
			places,
			row: place,
			rows: places,
			lookup,
			...functions,
			MagicArray
		});

		// Process HTML output of Pug into structured JSON
		let root = parse(sections_raw, { comment: true }); // Convert HTML string into DOM-type object for parsing

		// Process <mark> tags for text colour contrast
		root.querySelectorAll("mark").forEach(setMarkColor);

		function parseSection(node) {
			let obj = {};
			if (node.getAttribute("id")) obj.id = node.getAttribute("id");
			if (node.getAttribute("class")) obj.type = node.getAttribute("class");
			let content = "";
			let subsections = [];

			// Loop through children (h2, p, subsections etc)
			node.childNodes.forEach((child) => {
				if (child.nodeType === COMMENT_NODE) return;
				if (child.tagName == "SECTION") {
					subsections.push(child);
				} else if (child.tagName == "PROP" && child.getAttribute("class")) {
					let prop = child.getAttribute("class");
					if (prop === "data") {
						try {
							obj[prop] = JSON.parse(child.text);
						} catch (err) {
							throw new Error(`prop.data is not valid JSON: ${err.message}`);
						}
					} else {
						obj[prop] = child.text.includes("|")
							? child.text.split("|")
							: child.innerHTML;
					}
				} else {
					content += child.toString();
				}
			});
			if (content.length > 0) obj.content = content;

			// If there are sub-sections (eg. for scrollers), process these similarly sections
			if (subsections[0]) {
				obj.sections = subsections.map(parseSection);
			}
			return obj;
		}

		// Loop through main sections in the DOM and push them to the sections array
		if (root.childNodes.find((child) => child.getAttribute && child.tagName !== "SECTION")) {
			// If the document is not structured in sections
			sections.push(parseSection(root));
		} else {
			root.childNodes
				.filter((child) => child.getAttribute)
				.forEach((node) => {
					sections.push(parseSection(node));
				});
		}

		// Push any top level HTML comments to the notes array
		root.childNodes
			.filter((child) => child.nodeType === COMMENT_NODE)
			.forEach((node) => notes.push(node.rawText.trim()));
	} catch (err) {
		error = err.toString();
		console.warn(
			`PUG error. No HTML generated for ${place ? functions.getName(place, "the") || functions.getCode(place) : "no area selected"}`,
			err
		);
	}

	// Build the data object to be saved to JSON
	const data = { sections };
	if (place) {
		data.place = place;
		const region = lookup?.[functions.getParent(place)];
		const ctry = lookup?.[functions.getCountry(place)];
		if (region) data.region = region;
		if (ctry) data.ctry = ctry;
	}
	if (notes[0]) data.notes = notes;
	if (error) data.error = error;

	return data;
}
