// Internal helper for ascending(), descending() and the MagicArray ranking methods. Kept out of
// functions.js, as every export of that module is available in Pug templates.

// Sort order of a value's type, whichever direction values are sorted in: values (numbers,
// MagicNumbers, dates, booleans) first, then text (eg. "NA"), then missing values (null,
// undefined, NaN, "")
export const VALUE = 0;
export const TEXT = 1;
export const MISSING = 2;

export default function sortClass(val) {
	if (val == null || val === "") return MISSING;
	if (typeof val === "string") return TEXT;
	return Number.isNaN(+val) ? MISSING : VALUE;
}
