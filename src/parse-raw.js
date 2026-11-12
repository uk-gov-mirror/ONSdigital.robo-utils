// Internal helper for csvParse() and validateCSV(). Kept out of functions.js, as every export of
// that module is available in Pug templates.
import { csvParse } from "d3-dsv";

// Strip invisible byte-order mark common in CSV files
const stripBOM = (str) => (str.charCodeAt(0) === 0xfeff ? str.slice(1) : str);

// Parse CSV text into rows of strings, removing blank rows from the end (eg. ",,," lines left by
// spreadsheet software). Returns the rows and the number removed.
export default function parseRaw(str) {
	const raw = csvParse(stripBOM(str));
	let removed = 0;
	while (raw.length && Object.values(raw[raw.length - 1]).every((v) => !v.trim())) {
		raw.pop();
		removed++;
	}
	return { raw, removed };
}
