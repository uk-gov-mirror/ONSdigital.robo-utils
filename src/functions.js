import { formatLocale } from "d3-format";
import { roundTo } from "round-to";
import * as articles from "articles";
import pluralize from "pluralize-esm";
import converter from "./number-to-words.js";
import parseRaw from "./parse-raw.js";
import sortClass, { MISSING } from "./sort-class.js";
import MagicNumber from "./magic-number.js";
import MagicObject from "./magic-object.js";
import MagicArray from "./magic-array.js";

const f = formatLocale({
	decimal: ".",
	thousands: ",",
	grouping: [3],
	currency: ["£", ""]
}).format;

// Adapted from d3.autoType to inject special robo-utils "magic" types
export function autoType(object) {
	const fixtz =
		new Date("2019-01-01T00:00").getHours() || new Date("2019-07-01T00:00").getHours();
	for (var key in object) {
		var value = object[key].trim(),
			number,
			m;
		// "_array" columns are always arrays, even if empty or a single number/boolean
		if (key.slice(-6) === "_array" || value.includes("|")) {
			value = value.split("|");
			if (!value[value.length - 1]) value.pop();
		} else if (!value) value = null;
		else if (value === "true") value = true;
		else if (value === "false") value = false;
		else if (value === "NaN") value = new MagicNumber(NaN);
		else if (!isNaN((number = +value))) value = new MagicNumber(number);
		else if (
			(m = value.match(
				/^([-+]\d{2})?\d{4}(-\d{2}(-\d{2})?)?(T\d{2}:\d{2}(:\d{2}(\.\d{3})?)?(Z|[-+]\d{2}:\d{2})?)?$/
			))
		) {
			if (fixtz && !!m[4] && !m[7]) value = value.replace(/-/g, "/").replace(/T/, " ");
			value = new Date(value);
		} else continue;
		object[key] = value;
	}
	return new MagicObject(object);
}

export function makeLookup(items, codeKey, nameKey) {
	const lookup = {};
	for (const item of items) {
		if (codeKey) lookup[item[codeKey]] = item;
		if (nameKey) lookup[item[nameKey]] = item;
	}
	return lookup;
}

// Reliable way to check if a variable is a non-null number
export const isNumeric = (val) => isFinite(val) && val !== null;

// Accepts MagicNumbers (round-to only accepts primitive numbers)
export const round = (val, dp) => roundTo(+val, dp);

export const abs = (val) => new MagicNumber(Math.abs(val));

// Extended d3-format function to allow negative DPs and presentational SI units
export function format(val, str = ",", si = "long") {
	let dp = str.match(/-\d+(?=f)/)?.[0];
	let output;
	if (isNumeric(dp)) output = f(str.replace(`${dp}`, "0"))(round(+val, +dp));
	else output = f(str)(+val);
	if (si === "long")
		output = output
			.replace("k", " thousand")
			.replace("M", " million")
			.replace("G", " billion")
			.replace("T", " trillion");
	else output = output.replace("M", "mn").replace("G", "bn").replace("T", "tn");
	return output;
}

export function toWords(val, type = "cardinal", options = { threshold: 9, dropFirst: false }) {
	const threshold = options.threshold || 9;
	const dropFirst = options.dropFirst && type === "ordinal";
	const isWords = val <= threshold || threshold === -1;
	return +val === 1 && dropFirst
		? ""
		: isWords && type === "ordinal"
			? converter.toWordsOrdinal(val)
			: type === "ordinal"
				? converter.toOrdinal(val)
				: isWords
					? converter.toWords(val)
					: format(Math.floor(val));
}

export function toList(array, key, separator = [", ", " and "]) {
	const map = typeof key === "function" ? key : key == null ? (d) => d : (d) => d[key];
	const words = array.map(map);
	return words.length < 2
		? words.join()
		: Array.isArray(separator)
			? [...[words.slice(0, -1).join(separator[0])], ...words.slice(-1)].join(
					separator[1 % separator.length]
				)
			: words.join(separator);
}

// If mode !== "default", function only returns prefix
export function formatName(name, context = null, mode = "default") {
	if (name === "East") name = "East of England";
	name = name.replace("&", "and").replace(", City of", "").replace(", County of", "");
	let prefix = "";
	let lc = name.toLowerCase();
	let island = lc.startsWith("isle");
	let the =
		[
			"united kingdom",
			"north east",
			"north west",
			"east midlands",
			"west midlands",
			"east of england",
			"south east",
			"south west",
			"derbyshire dales"
		].includes(lc) ||
		lc.startsWith("city of") ||
		lc.startsWith("vale of");
	if (["in", "the", "its"].includes(context)) {
		if (island || the) prefix = "the ";
	}
	if (context === "in") {
		if (island) prefix = "on " + prefix;
		else prefix = "in " + prefix;
	} else if (context === "its") {
		name = name + (name.slice(-1) === "s" ? "'" : "'s");
	}
	return mode === "default" ? prefix + name : prefix.slice(0, -1);
}

// Find a column by name, then by suffix, then fall back (matching ignores case,
// but the original key is returned, eg. "LAD21CD")
function findKey(obj, names, suffixes, fallbacks = []) {
	const keys = Object.keys(obj);
	const lc = keys.map((key) => key.toLowerCase());
	for (const name of names) {
		const i = lc.indexOf(name);
		if (i > -1) return keys[i];
	}
	for (const suffix of suffixes) {
		const i = lc.findIndex((key) => key.endsWith(suffix));
		if (i > -1) return keys[i];
	}
	for (const name of fallbacks) {
		const i = lc.indexOf(name);
		if (i > -1) return keys[i];
	}
	return keys[0];
}

export function getCodeKey(obj) {
	return findKey(obj, ["areacd", "code", "id"], ["code", "cd"]);
}

export function getNameKey(obj) {
	return findKey(obj, ["hclnm", "areanm", "name", "label"], ["name", "nm"], ["areacd"]);
}

export function getParentKey(obj) {
	const keys = Object.keys(obj);
	const lc = keys.map((key) => key.toLowerCase());
	for (let key of ["parentcd", "parent", "regioncd", "region"]) {
		let i = lc.indexOf(key);
		if (i > -1) return keys[i];
	}
	return null;
}

export function getProps(item) {
	if (!item || typeof item !== "object") return {};
	return {
		codeKey: getCodeKey(item),
		nameKey: getNameKey(item),
		parentKey: getParentKey(item)
	};
}

export function getName(place, context = null, mode = "default") {
	const nameKey = getNameKey(place);
	return formatName(place[nameKey], context, mode);
}

export function getCode(place) {
	const codeKey = getCodeKey(place);
	return place[codeKey];
}

export function getParent(place) {
	const parentKey = getParentKey(place);
	return place[parentKey];
}

export function getCountry(place) {
	const countries = { E: "E92000001", N: "N92000002", S: "S92000003", W: "W92000004" };
	return countries[String(getCode(place))[0]];
}

export function moreLess(diff, texts = ["more", "less", "same"]) {
	return diff > 0 ? texts[0] : diff < 0 ? texts[1] : texts[2];
}

export function breaksToWords(value, breaks = [0], texts = ["less", "more"], quantifier = null) {
	if (quantifier && value === breaks[breaks.length - 1])
		return `${quantifier} ${texts[texts.length - 2]}`;
	for (let i = 0; i < breaks.length; i++) {
		if (quantifier && value === breaks[i]) return `${quantifier} ${texts[i + 1]}`;
		if (value <= breaks[i]) return texts[i];
	}
	return texts[texts.length - 1];
}

export function capitalise(str) {
	return str[0] ? str[0].toUpperCase() + str.slice(1) : str;
}

// Array returned by toData() serialises to JSON when Pug outputs it (eg. prop.data= places.toData(...))
const asData = (data) =>
	Object.defineProperty(data, "toString", { value: () => JSON.stringify(data) });

export function toData(arr, props, mode = null) {
	try {
		let _props = [];
		for (const prop of Object.keys(props)) {
			if (props[prop])
				_props.push({
					key: prop,
					value: props[prop],
					type:
						Array.isArray(props[prop]) && !props[prop].every((val) => arr[0][val])
							? "label"
							: "key"
				});
		}
		const propsUni = _props.filter((p) => typeof p.value === "string");
		const propsMulti = _props.filter((p) => Array.isArray(p.value));
		let data = [];
		for (const d of arr) {
			let row = {};
			let rows = [];
			for (const p of propsUni) row[p.key] = d[p.value];
			if (propsMulti[0]) {
				for (let i = 0; i < propsMulti[0].value.length; i++) {
					let rowNew = { ...row };
					for (const p of propsMulti)
						rowNew[p.key] = p.type === "label" ? p.value[i] : d[p.value[i]];
					rows.push(rowNew);
				}
			}
			if (rows[0]) {
				for (const r of rows) data.push(r);
			} else data.push(row);
		}
		return mode === "protect"
			? `§${JSON.stringify(data)}§`
			: mode === "stringify"
				? JSON.stringify(data)
				: asData(data);
	} catch (err) {
		console.warn("Could not generate data", { arr, props }, err);
		return mode === "protect"
			? `§${JSON.stringify([])}§`
			: mode === "stringify"
				? JSON.stringify([])
				: asData([]);
	}
}

// Modifed d3.csvParse to strip byte order mark (BOM), remove blank rows from the end of the file
// (with a warning) and apply robo-utils autoType by default. Blank rows elsewhere are kept.
export function csvParse(str, row = autoType) {
	const { raw, removed } = parseRaw(str);
	if (removed)
		console.warn(
			`csvParse: removed ${removed} blank row${removed > 1 ? "s" : ""} from the end of the data`
		);
	if (!row) return raw;
	const rows = [];
	rows.columns = raw.columns;
	raw.forEach((d, i) => {
		const r = row(d, i, raw.columns);
		if (r != null) rows.push(r);
	});
	return rows;
}

// Fetch raw CSV file and return a MagicArray
export async function getData(url) {
	const data = csvParse(await (await fetch(url)).text());
	return MagicArray.from(data);
}

// Values first, then text, then missing values (see sort-class.js), in either direction
function compare(a, b, sign) {
	const a_class = sortClass(a),
		b_class = sortClass(b);
	if (a_class !== b_class) return a_class < b_class ? -1 : 1;
	if (a_class === MISSING) return 0;
	return a < b ? -sign : a > b ? sign : 0;
}

export function ascending(a, b) {
	return compare(a, b, 1);
}

export function descending(a, b) {
	return compare(a, b, -1);
}

export function addToArray(arr, items) {
	const _items = Array.isArray(items) ? items : [items];
	const codeKey = getCodeKey(_items[0]);
	for (const item of _items) {
		if (!arr.map((d) => d[codeKey]).includes(item[codeKey])) arr.push(item);
	}
	return arr;
}

export function removeFromArray(arr, items) {
	const _items = Array.isArray(items) ? items : [items];
	const codeKey = getCodeKey(_items[0]);
	const codes = _items.map((d) => d[codeKey]);
	return arr.filter((d) => !codes.includes(d[codeKey]));
}

// If mode !== "default", function only returns article
export const aAn = (str, mode = "default") =>
	mode === "default" ? `${articles.find(str)} ${str}` : articles.find(str);
export function getExtreme(arr, keys, mode = "highest") {
	if (!Array.isArray(keys) || keys.length === 0) {
		throw new Error("Input must be a non-empty array of keys.");
	}

	const validModes = [
		"highest",
		"lowest",
		"max",
		"min",
		"absolute_highest",
		"absolute_lowest",
		"absolute_max",
		"absolute_min"
	];
	if (!validModes.includes(mode)) {
		throw new Error(
			"Mode must be 'highest', 'lowest', 'max', 'min', 'absolute_highest', 'absolute_lowest', 'absolute_max', or 'absolute_min'."
		);
	}

	const isAbsolute = mode.startsWith("absolute_");
	const isHighest =
		mode === "highest" ||
		mode === "max" ||
		mode === "absolute_highest" ||
		mode === "absolute_max";

	// Helper function to convert values to numbers for comparison
	const toNumber = (val) => {
		if (val == null || val === "") return null;
		const num = Number(val);
		return isNaN(num) ? null : num;
	};

	let extremeKey = keys[0];
	let extremeValue = toNumber(arr[extremeKey]);

	for (let i = 1; i < keys.length; i++) {
		const key = keys[i];
		const value = toNumber(arr[key]);
		// Skip null, undefined, and non-numeric values
		if (value == null) continue;

		// If current extreme is null/undefined, replace it
		if (extremeValue == null) {
			extremeValue = value;
			extremeKey = key;
			continue;
		}

		let shouldReplace;

		if (isAbsolute) {
			// For absolute mode, compare absolute values
			const absValue = Math.abs(value);
			const absExtreme = Math.abs(extremeValue);
			if (isHighest) {
				// Find the value with the largest absolute value
				shouldReplace = absValue > absExtreme;
			} else {
				// Find the value with the smallest absolute value
				shouldReplace = absValue < absExtreme;
			}
		} else {
			// Regular mode - compare actual values
			shouldReplace = isHighest ? value > extremeValue : value < extremeValue;
		}

		if (shouldReplace) {
			extremeValue = value;
			extremeKey = key;
		}
	}

	return extremeKey;
}

// Convenience wrapper functions for backward compatibility
export function highestFromArray(arr, keys) {
	return getExtreme(arr, keys, "highest");
}

export function lowestFromArray(arr, keys) {
	return getExtreme(arr, keys, "lowest");
}

export const pluralise = (str, count = undefined, inclusive = false) =>
	count ? pluralize(str, count, inclusive) : pluralize.plural(str);

export const singularise = (str) => pluralize.singular(str);

// Describe the change from one value to another, eg. "increased by 5.2%"
// type: "percent" (relative change), "absolute" (difference) or "pp" (difference in percentage points)
export function describeChange(from, to, options = {}) {
	const {
		type = "percent",
		str = type === "absolute" ? "," : ".1f",
		texts = ["increased", "decreased", "was unchanged"],
		threshold = 0
	} = options;
	if (!isNumeric(from) || !isNumeric(to)) return "";
	const diff = +to - +from;
	const change = type === "percent" ? (diff / Math.abs(+from)) * 100 : diff;
	if (!isFinite(change)) return diff > 0 ? texts[0] : diff < 0 ? texts[1] : texts[2];
	const amount = format(Math.abs(change), str);
	// Changes within the threshold, or that round to zero, are described as unchanged
	if (Math.abs(change) <= threshold || !/[1-9]/.test(amount)) return texts[2];
	const units =
		type === "percent"
			? "%"
			: type === "pp"
				? +amount === 1
					? " percentage point"
					: " percentage points"
				: "";
	return `${diff > 0 ? texts[0] : texts[1]} by ${amount}${units}`;
}

// Round to significant figures and hedge the result, eg. 5.97 => "almost 6", 1.03e6 => "just over 1 million"
export function approx(val, sf = 2, options = {}) {
	const { texts = ["almost", "around", "just over"], threshold = 0.05 } = options;
	const value = +val;
	const rounded = +value.toPrecision(sf);
	const text = format(rounded, Math.abs(rounded) >= 1e6 ? `.${sf}~s` : `,.${sf}~r`);
	const diff = (Math.abs(value) - Math.abs(rounded)) / Math.abs(rounded);
	if (diff === 0 || !isFinite(diff)) return text;
	const hedge = Math.abs(diff) > threshold ? texts[1] : diff < 0 ? texts[0] : texts[2];
	return `${hedge} ${text}`;
}

const fractionNames = {
	2: ["half", "halves"],
	3: ["third", "thirds"],
	4: ["quarter", "quarters"],
	5: ["fifth", "fifths"],
	6: ["sixth", "sixths"],
	7: ["seventh", "sevenths"],
	8: ["eighth", "eighths"],
	9: ["ninth", "ninths"],
	10: ["tenth", "tenths"]
};

// Describe a proportion (0 to 1) as the nearest simple fraction
// mode "in" => "one in five", mode "fraction" => "a fifth"
export function toFraction(val, mode = "in", denominators = [2, 3, 4, 5, 10]) {
	const value = +val;
	if (!(value > 0 && value < 1)) return "";
	// Small proportions are always "one in x"
	if (value < 1 / Math.max(...denominators)) return `one in ${toWords(Math.round(1 / value))}`;
	let best;
	for (const d of [...denominators].sort(ascending)) {
		const n = Math.min(Math.max(Math.round(value * d), 1), d - 1);
		const error = Math.abs(value - n / d);
		if (!best || error < best.error) best = { n, d, error };
	}
	const { n, d } = best;
	if (mode !== "fraction") return `${toWords(n)} in ${toWords(d)}`;
	if (n === 1) return d === 2 ? "half" : `a ${fractionNames[d][0]}`;
	return `${toWords(n)}-${fractionNames[d][1]}`;
}

// Describe a rank, eg. 1 => "the highest", 2 => "the second highest", 12 (tied) => "the joint 12th highest"
export function describeRank(rank, label = "highest", tied = false) {
	const ordinal = toWords(rank, "ordinal", { dropFirst: true });
	return ["the", tied ? "joint" : "", ordinal, label].filter((d) => d).join(" ");
}

const dateFormats = {
	day: { day: "numeric", month: "long", year: "numeric" },
	month: { month: "long", year: "numeric" },
	year: { year: "numeric" }
};

// Accept a Date, a date string or a year (number)
function toDate(val) {
	if (val instanceof Date) return val;
	if (typeof val === "string" && isNaN(+val)) return new Date(val);
	return new Date(Date.UTC(+val, 0, 1));
}

function formatParts(date, options) {
	return new Intl.DateTimeFormat("en-GB", { ...options, timeZone: "UTC" }).format(date);
}

// Format a date in ONS style, eg. "4 March 2024", "March 2024" or "2024" (unit = "day", "month" or "year")
// Dates are formatted in UTC, to match dates parsed from CSV files
export function formatDate(date, unit = "day") {
	if (!dateFormats[unit]) throw new Error("Unit must be 'day', 'month' or 'year'.");
	return formatParts(toDate(date), dateFormats[unit]);
}

// Format a period in ONS style, eg. "2010 to 2020", "January to March 2024", "4 to 15 March 2024"
export function formatPeriod(start, end, unit = "year") {
	const [a, b] = [toDate(start), toDate(end)];
	const last = formatDate(b, unit);
	if (formatDate(a, unit) === last) return last;
	const sameYear = a.getUTCFullYear() === b.getUTCFullYear();
	const sameMonth = sameYear && a.getUTCMonth() === b.getUTCMonth();
	const first =
		unit === "month" && sameYear
			? formatParts(a, { month: "long" })
			: unit === "day" && sameMonth
				? formatParts(a, { day: "numeric" })
				: unit === "day" && sameYear
					? formatParts(a, { day: "numeric", month: "long" })
					: formatDate(a, unit);
	return `${first} to ${last}`;
}

// Compare a value with a reference value, eg. "higher than"
// threshold is relative (eg. 0.05 means values within 5% of ref are the same)
export function compareTo(value, ref, options = {}) {
	const { threshold = 0, texts = ["higher than", "the same as", "lower than"] } = options;
	const diff = +value - +ref;
	const relative = +ref === 0 ? diff : diff / Math.abs(+ref);
	return Math.abs(relative) <= threshold ? texts[1] : diff > 0 ? texts[0] : texts[2];
}
