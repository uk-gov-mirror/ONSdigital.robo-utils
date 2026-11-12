import MagicNumber from "./magic-number.js";
import {
	toList,
	toData,
	ascending,
	descending,
	addToArray,
	removeFromArray,
	describeRank,
	getCode,
	getProps,
	makeLookup
} from "./functions.js";
import sortClass, { MISSING } from "./sort-class.js";

// Lookup and column keys are worked out when first used (and again if the length changes),
// so they also work for arrays created by built-in methods like .filter() and .slice()
const state = new WeakMap();
const getState = (arr) => state.get(arr) ?? state.set(arr, {}).get(arr);

// Rows that can be ranked by a column: those whose value has the column's leading type (see
// sort-class.js). Usually the numbers, leaving out missing values and text like "NA". If the
// column only has text, the text rows.
function rankable(arr, key) {
	let lead = MISSING;
	for (const d of arr) lead = Math.min(lead, sortClass(d[key]));
	return lead === MISSING
		? arr.filter(() => false)
		: arr.filter((d) => sortClass(d[key]) === lead);
}

// The n rows at the top (or bottom) of a column, with any rows tied with the last one if ties = true
function extremes(arr, key, n, add, ties, end) {
	const sorted = rankable(arr, key).descending(key);
	const tied = (i, j) => ascending(sorted[i][key], sorted[j][key]) === 0;
	let result;
	if (end === "top") {
		let stop = Math.min(Math.max(0, n), sorted.length);
		while (ties && stop > 0 && stop < sorted.length && tied(stop, stop - 1)) stop++;
		result = sorted.slice(0, stop);
	} else {
		let start = Math.max(0, sorted.length - Math.max(0, n));
		while (ties && start > 0 && start < sorted.length && tied(start - 1, start)) start--;
		result = sorted.slice(start);
	}
	if (add) result = result.add(add);
	if (ties) return result.length === n ? result : result.descending(key);
	return result.length === 1 ? result[0] : result.length === n ? result : result.descending(key);
}

// A rank that can be used as a number, with details of any ties
class MagicRank extends MagicNumber {
	constructor(rank, ties = []) {
		super(rank);
		this.isTied = ties.length > 0;
		this.ties = ties;
	}
	// eg. "the joint second highest"
	describe(label = "highest") {
		return describeRank(this, label, this.isTied);
	}
}

export default class MagicArray extends Array {
	static from(iterable, mapFn, thisArg) {
		// This method allows for the creation of a MagicArray from very large regular JS arrays
		const array = Array.from(iterable, mapFn, thisArg);

		const result = new MagicArray();
		for (let i = 0; i < array.length; i++) {
			result[i] = array[i];
		}
		return result;
	}
	get codeKey() {
		return getState(this).codeKey ?? getProps(this[0]).codeKey;
	}
	set codeKey(key) {
		getState(this).codeKey = key;
		delete getState(this).lookup;
	}
	get nameKey() {
		return getState(this).nameKey ?? getProps(this[0]).nameKey;
	}
	set nameKey(key) {
		getState(this).nameKey = key;
		delete getState(this).lookup;
	}
	get parentKey() {
		return getState(this).parentKey ?? getProps(this[0]).parentKey;
	}
	set parentKey(key) {
		getState(this).parentKey = key;
	}
	get lookup() {
		const s = getState(this);
		if (!s.lookup || s.length !== this.length) {
			s.lookup = makeLookup(this, this.codeKey, this.nameKey);
			s.length = this.length;
		}
		return s.lookup;
	}
	set lookup(lookup) {
		Object.assign(getState(this), { lookup, length: this.length });
	}
	get(key) {
		return this.lookup[key];
	}
	// Re-detect column keys and rebuild the lookup (eg. after replacing items in place)
	refreshProps() {
		state.delete(this);
	}
	sortBy(key, order = "ascending") {
		return order === "ascending" ? this.ascending(key) : this.descending(key);
	}
	filterBy(key, val) {
		// Compare primitive values so MagicNumber (and Date) cells match plain values
		return this.filter((d) => d[key]?.valueOf() === val?.valueOf());
	}
	toList(key, separator = [", ", " and "]) {
		return toList(this, key, separator);
	}
	toData(props, mode = null) {
		return toData(this, props, mode);
	}
	// Rank counting tied values as equal (1, 1, 3), with the codes of any other tied items.
	// Null if the item's value can't be ranked (eg. it's missing, or text in a column of numbers)
	getRank(item, key, order = "descending") {
		const rows = rankable(this, key);
		if (!rows.length || sortClass(item[key]) !== sortClass(rows[0][key])) return null;
		const compare = order === "descending" ? descending : ascending;
		const better = rows.filter((d) => compare(d[key], item[key]) < 0);
		const ties = rows
			.filter((d) => compare(d[key], item[key]) === 0 && getCode(d) !== getCode(item))
			.map((d) => getCode(d));
		return new MagicRank(better.length + 1, ties);
	}
	add(items) {
		return addToArray(MagicArray.from(this), items);
	}
	remove(items) {
		return removeFromArray(this, items);
	}
	ascending(key) {
		return MagicArray.from(this).sort((a, b) => ascending(a[key], b[key]));
	}
	descending(key) {
		return MagicArray.from(this).sort((a, b) => descending(a[key], b[key]));
	}
	top(key, n = 1, add = null, ties = false) {
		return extremes(this, key, n, add, ties, "top");
	}
	bottom(key, n = 1, add = null, ties = false) {
		return extremes(this, key, n, add, ties, "bottom");
	}
	between(
		key,
		start,
		end,
		mode = "rank",
		order = "descending",
		add = null,
		excludeTarget = false
	) {
		let result;
		if (mode === "rank") {
			// Get items between specific ranks
			const sorted = rankable(this, key).sortBy(key, order);
			const startIndex = Math.max(0, start - 1); // Convert to 0-based index
			const endIndex = Math.min(sorted.length, end); // Inclusive end
			result = MagicArray.from(sorted.slice(startIndex, endIndex));
		} else if (mode === "value") {
			// Get items between specific values
			const minVal = Math.min(start, end);
			const maxVal = Math.max(start, end);
			result = MagicArray.from(
				rankable(this, key).filter((d) => d[key] >= minVal && d[key] <= maxVal)
			);
			result = result.sortBy(key, order);
		} else if (mode === "around") {
			// Get items around a specific item's rank
			const targetItem = start; // start is the target item
			const range = end; // end is the range (+/- positions)
			// Use the target's position in the sorted array (not its rank, which is shared by ties)
			const sorted = rankable(this, key).sortBy(key, order);
			const position = sorted.findIndex((d) => getCode(d) === getCode(targetItem)) + 1;
			const startRank = Math.max(1, position - range);
			const endRank = Math.min(sorted.length, position + range);
			const startIndex = startRank - 1;
			const endIndex = endRank;
			result = MagicArray.from(sorted.slice(startIndex, endIndex));

			// Exclude the target item itself if requested
			if (excludeTarget) {
				result = result.filter((item) => item !== targetItem);
			}
		} else {
			throw new Error(`Invalid mode: ${mode}. Use 'rank', 'value', or 'around'.`);
		}

		if (add) {
			result = result.add(add);
		}

		return result.length === 1 ? result : result.sortBy(key, order);
	}
	trim(n) {
		return n >= 0 ? this.slice(0, Math.floor(n)) : this.slice(Math.floor(n));
	}
	flip() {
		return MagicArray.from(this).reverse();
	}
}
