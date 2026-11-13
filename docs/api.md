# API reference

Every function and class exported by `@onsvisual/robo-utils`. For an overview and getting-started example, see the [README](../README.md).

**Contents**

- [Loading data](#loading-data): [csvParse](#csvparse), [autoType](#autotype), [getData](#getdata), [validateCSV](#validatecsv)
- [MagicArray](#magicarray): [get](#magicarrayget), [sortBy](#magicarraysortby), [filterBy](#magicarrayfilterby), [top](#magicarraytop), [bottom](#magicarraybottom), [between](#magicarraybetween), [getRank](#magicarraygetrank), [add](#magicarrayadd), [remove](#magicarrayremove), [trim](#magicarraytrim), [flip](#magicarrayflip), [toList](#magicarraytolist), [toData](#magicarraytodata), [refreshProps](#magicarrayrefreshprops)
- [MagicObject](#magicobject): [getName](#magicobjectgetname), [getCode](#magicobjectgetcode), [getParent](#magicobjectgetparent), [getCountry](#magicobjectgetcountry), [highest](#magicobjecthighest), [lowest](#magicobjectlowest), [toData](#magicobjecttodata)
- [MagicNumber](#magicnumber)
- [Numbers](#numbers): [format](#format), [round](#round), [abs](#abs), [approx](#approx), [toWords](#towords), [toFraction](#tofraction)
- [Change, comparison and rank](#change-comparison-and-rank): [describeChange](#describechange), [compareTo](#compareto), [describeRank](#describerank), [moreLess](#moreless), [breaksToWords](#breakstowords)
- [Text](#text): [toList](#tolist), [aAn](#aan), [capitalise](#capitalise), [pluralise](#pluralise), [singularise](#singularise)
- [Place names and codes](#place-names-and-codes): [formatName](#formatname), [getName](#getname), [getCode](#getcode), [getParent](#getparent), [getCodeKey, getNameKey, getParentKey](#getcodekey-getnamekey-getparentkey)
- [Dates](#dates): [formatDate](#formatdate), [formatPeriod](#formatperiod)
- [Chart data](#chart-data): [toData](#todata)
- [Templates](#templates): [renderJSON](#renderjson)
- [Sorting](#sorting): [ascending, descending](#ascending-descending)

**Example data**

The examples below use this data:

```js
import { MagicArray, csvParse } from "@onsvisual/robo-utils";

const csv = `areacd,areanm,parentcd,pop_2011,pop_2021,pc_degree
E06000001,Hartlepool,E12000001,92028,92338,0.21
E06000002,Middlesbrough,E12000001,138412,143924,0.24
E06000003,Redcar and Cleveland,E12000001,135177,136531,0.22
E06000004,Stockton-on-Tees,E12000001,191610,196595,0.29
E06000005,Darlington,E12000001,105564,107836,0.27
E12000001,North East,E92000001,2596886,2647013,0.27
E92000001,England,,53012456,56490048,0.34`;

const data = MagicArray.from(csvParse(csv)); // all rows
const places = data.filter((d) => d.areacd.startsWith("E06")); // local authorities
const place = places.get("Hartlepool");
```

**In Pug templates**, rendered with [renderJSON](#renderjson), every function on this page is available by name, along with `place`, `places`, `lookup` and `MagicArray`. So `approx(place.pop_2021)` and `place.pop_2021.approx()` both work, and you can write either inline:

```pug
p The population was #{place.pop_2021.approx()} in 2021.
```

## Loading data

### csvParse

```js
csvParse(str, row = autoType)
```

Parses a CSV string, using [autoType](#autotype) to convert each row by default. A byte-order mark at the start of the file is removed. Blank rows at the end of the file (eg. `,,,` lines left by spreadsheet software) are removed with a console warning. Blank rows elsewhere are kept. Returns an array of [MagicObject](#magicobject) rows; wrap it in `MagicArray.from()` to use the [MagicArray](#magicarray) methods.

```js
csvParse("areacd,areanm,value,tags\nE1,Foo,5,a|b")[0];
// MagicObject { areacd: "E1", areanm: "Foo", value: MagicNumber(5), tags: ["a", "b"] }

csvParse(csv, (d) => d); // custom row function: values stay as strings
```

### autoType

```js
autoType(object)
```

Converts the string values of a row object, and returns it as a [MagicObject](#magicobject):

| Value                                | Becomes                                             |
| ------------------------------------ | --------------------------------------------------- |
| `"5"`, `"-3.5"`, `"1e3"`, `"NaN"`    | [MagicNumber](#magicnumber)                         |
| `"true"`, `"false"`                  | `true`, `false`                                     |
| `""`                                 | `null`                                              |
| `"2024-03-04"`, `"2024-03-04T12:30"` | `Date` (date-only values are UTC midnight)          |
| `"a\|b"`                             | `["a", "b"]`                                        |
| anything in a column ending `_array` | an array, even `"2020"` (`["2020"]`) or `""` (`[]`) |
| anything else                        | unchanged string                                    |

```js
autoType({ value: "5", flag: "true", date: "2024-03-04", tags: "a|b", empty: "" });
// MagicObject { value: MagicNumber(5), flag: true, date: Date(2024-03-04), tags: ["a", "b"], empty: null }
```

> [!NOTE]
> Numbers are `MagicNumber` objects, so `place.pop_2021 === 92338` is `false` and a `0` value is truthy. Compare with `==`, `+place.pop_2021` or `.valueOf()`.

### getData

```js
await getData(url)
```

Fetches a CSV file and returns it as a [MagicArray](#magicarray), parsed with [csvParse](#csvparse).

```js
const data = await getData("https://example.com/data.csv");
```

### validateCSV

```js
validateCSV(str, { codeKey = null, nameKey = null } = {})
```

Checks a CSV string for problems that would break a template, parsing it as [csvParse](#csvparse) does. It runs these checks:

| `id`             | Finds                                                                                                       |
| ---------------- | ----------------------------------------------------------------------------------------------------------- |
| `blankRows`      | Blank rows. Blank rows at the end of the file aren't reported, as `csvParse` removes them (see `removedBlankRows`) |
| `noCode`         | Rows with data but no value in the code column                                                              |
| `noName`         | Rows with a code but no value in the name column (skipped if there's no name column)                        |
| `duplicateCodes` | Codes used in more than one row (ignoring surrounding spaces)                                               |
| `mixedTypes`     | Columns with more than one type of value (eg. numbers and `"NA"`). Empty cells are allowed in any column    |

It returns a report object, and doesn't log anything. Row numbers are spreadsheet rows, where the header is row 1. Each problem has a `message` with the same text as the `check-data.js` script in robo-article, robo-embed and robo-scrolly. `codeKey` and `nameKey` are the code and name columns: the ones given as options, or else detected with [getCodeKey and getNameKey](#getcodekey-getnamekey-getparentkey). `nameKey` is `null` if there's no name column, including when it's the same as `codeKey`. `problems` is the number of checks that failed.

```js
validateCSV("areacd,areanm,value\nE1,Hull,5\nE1,Leeds,NA\n,,\n,York,7\n,,\n");
// {
//   rows: 4,
//   columns: ["areacd", "areanm", "value"],
//   removedBlankRows: 1,
//   codeKey: "areacd",
//   nameKey: "areanm",
//   checks: [
//     { id: "blankRows", title: "Blank rows", passed: false,
//       problems: [{ row: 4, message: "row 4" }] },
//     { id: "noCode", title: "Rows with no code", passed: false,
//       problems: [{ row: 5, name: "York", message: "row 5 (York)" }] },
//     { id: "noName", title: "Rows with no name", passed: true, problems: [] },
//     { id: "duplicateCodes", title: "Duplicate codes", passed: false,
//       problems: [{ code: "E1", rows: [{ row: 2, name: "Hull" }, { row: 3, name: "Leeds" }],
//                    message: "E1: row 2 (Hull), row 3 (Leeds)" }] },
//     { id: "mixedTypes", title: "Columns with mixed types", passed: false,
//       problems: [{ column: "value",
//                    types: [{ type: "number", count: 2, examples: [] },
//                            { type: "string", count: 1, examples: [{ row: 3, value: "NA" }] }],
//                    hint: null,
//                    message: 'value: 2 number, 1 string. string: "NA" (row 3).' }] }
//   ],
//   problems: 4,
//   passed: false,
//   error: null
// }
```

In `mixedTypes`, `types` is sorted with the most common type first, and every other type has up to 3 `examples` with their original text. `hint` suggests renaming the column to end `_array` if one of the types is `array`, and is `null` otherwise. Types are `number`, `string`, `boolean`, `date` and `array`.

`noName` problems are `{ row, code, message }`, eg. `{ row: 6, code: "E2", message: "row 6 (E2)" }`.

To choose the columns, for example when the user picks them:

```js
validateCSV(csv, { codeKey: "id", nameKey: "label" });
```

If the CSV has no rows, `error` is `"No rows found"`. If `codeKey` or `nameKey` isn't one of the columns, `error` is eg. `"Column not found: id"`. In both cases `checks` is empty and `passed` is `false`.

## MagicArray

An `Array` of rows (usually [MagicObjects](#magicobject)) with extra methods for sorting, filtering, ranking and listing. Create one with `MagicArray.from(rows)`.

A `MagicArray` detects which columns hold each row's code, name and parent code from its first row (see [getCodeKey](#getcodekey-getnamekey-getparentkey)), and builds a `lookup` object of rows keyed by both code and name, which [get](#magicarrayget) uses. These are available as `codeKey`, `nameKey`, `parentKey` and `lookup`, and can be set to override them. The lookup is rebuilt when the number of rows changes.

`columns` has the column names, like the array returned by [csvParse](#csvparse). `MagicArray.from()` copies them from the array it's given (unless it's given a `mapFn`), and methods that return rows keep them, including `.filter()` and `.slice()`. Otherwise, they're the keys of the first row. Like the other properties, `columns` can be set, and isn't included in `Object.keys()` or JSON.

```js
data.columns; // ["areacd", "areanm", "parentcd", "pop_2011", "pop_2021", "pc_degree"]
places.columns; // the same, as places is filtered from data
MagicArray.from([{ areacd: "E1", value: 5 }]).columns; // ["areacd", "value"]
```

Methods that return several rows return a new `MagicArray`, so they can be chained:

```js
places.sortBy("pop_2021", "descending").trim(3).toList("areanm");
// "Stockton-on-Tees, Middlesbrough and Redcar and Cleveland"
```

### MagicArray.get

```js
places.get(key)
```

Returns the row with this code or name.

```js
places.get("Hartlepool").areacd; // "E06000001"
data.get("E06000001").areanm; // "Hartlepool"
```

### MagicArray.sortBy

```js
places.sortBy(key, order = "ascending")
```

Sorts by a column, `"ascending"` or `"descending"`. Returns a new array. `places.ascending(key)` and `places.descending(key)` are shortcuts. Rows with missing values, and text in a column of numbers (eg. `"NA"`), go at the end in either order (see [ascending, descending](#ascending-descending)). Rows with equal values keep their order.

```js
places.sortBy("pop_2021", "descending").toList("areanm");
// "Stockton-on-Tees, Middlesbrough, Redcar and Cleveland, Darlington and Hartlepool"
```

### MagicArray.filterBy

```js
places.filterBy(key, value)
```

Returns the rows where a column equals `value`. Numbers match by value, so a plain number matches a `MagicNumber` cell.

```js
places.filterBy("parentcd", "E12000001").length; // 5
places.filterBy("pop_2021", 92338).toList("areanm"); // "Hartlepool"
```

### MagicArray.top

```js
places.top(key, n = 1, add = null, ties = false)
```

Returns the `n` rows with the highest values. With `n = 1`, returns the row itself rather than an array. `add` is a row (or array of rows) to include as well, for example the selected place; the result is then re-sorted.

Rows with missing values, and text in a column of numbers (eg. `"NA"`), are left out, as in [getRank](#magicarraygetrank). If there are fewer than `n` other rows, all of them are returned. Rows from `add` are always included, at the end if their value is missing.

With `ties = true`, rows with the same value as the `n`th row are included too, so there can be more than `n` rows. The result is then always an array, even for one row. To describe a tie, use [getRank](#magicarraygetrank) (`isTied` and `ties`).

```js
places.top("pop_2021").areanm; // "Stockton-on-Tees"
places.top("pop_2021", 2).toList("areanm"); // "Stockton-on-Tees and Middlesbrough"
places.top("pop_2021", 2, place).toList("areanm"); // "Stockton-on-Tees, Middlesbrough and Hartlepool"

// Darlington and the North East both have 0.27
data.top("pc_degree", 3).toList("areanm"); // "England, Stockton-on-Tees and Darlington"
data.top("pc_degree", 3, null, true).toList("areanm");
// "England, Stockton-on-Tees, Darlington and North East"
```

### MagicArray.bottom

```js
places.bottom(key, n = 1, add = null, ties = false)
```

Like [top](#magicarraytop), for the lowest values, including leaving out missing values and the `ties` option. The result is still sorted highest first.

```js
places.bottom("pop_2021", 2).toList("areanm"); // "Darlington and Hartlepool"
```

### MagicArray.between

```js
places.between(key, start, end, mode = "rank", order = "descending", add = null, excludeTarget = false)
```

Returns rows from a range, sorted by `key` in `order`. Always returns an array, even for a single row. Rows with missing values, and text in a column of numbers, are left out (unless they're in `add`), as in [getRank](#magicarraygetrank).

| `mode`     | `start`     | `end`              | Returns                                        |
| ---------- | ----------- | ------------------ | ---------------------------------------------- |
| `"rank"`   | first rank  | last rank          | rows ranked `start` to `end`                   |
| `"value"`  | lower value | upper value        | rows with values in the range (either order)   |
| `"around"` | a row       | a number of places | the row and up to `end` rows either side of it |

`add` includes extra rows, as in [top](#magicarraytop). With `excludeTarget = true`, `"around"` mode leaves out the row itself.

```js
places.between("pop_2021", 2, 3).toList("areanm");
// "Middlesbrough and Redcar and Cleveland"

places.between("pop_2021", 100000, 150000, "value").toList("areanm");
// "Middlesbrough, Redcar and Cleveland and Darlington"

places.between("pop_2021", place, 1, "around").toList("areanm");
// "Darlington and Hartlepool"

places.between("pop_2021", place, 1, "around", "descending", null, true).toList("areanm");
// "Darlington"
```

### MagicArray.getRank

```js
places.getRank(row, key, order = "descending")
```

Returns a row's rank (1 = highest, or lowest with `order = "ascending"`). Tied values share a rank: two rows tied for first are both ranked 1, and the next is ranked 3. Rows with missing values, and text in a column of numbers (eg. `"NA"`), are left out, and their own rank is `null`, so `if rank` checks that a row has one.

The rank is a [MagicNumber](#magicnumber), so it can be used anywhere a number can, with these extras:

- `isTied`: `true` if other rows have the same value
- `ties`: the codes of the other rows with the same value
- `describe(label = "highest")`: the rank in words, with "joint" for ties (see [describeRank](#describerank))

```js
const rank = places.getRank(place, "pop_2021");
+rank; // 5
rank.isTied; // false
rank.toWords("ordinal"); // "fifth"
rank.describe("largest"); // "the fifth largest"

places.getRank(place, "pop_2021", "ascending").describe("smallest"); // "the smallest"

// Darlington and the North East both have 0.27
const tied = data.getRank(data.get("Darlington"), "pc_degree");
+tied; // 3
tied.isTied; // true
tied.ties; // ["E12000001"]
tied.describe(); // "the joint third highest"
```

In a Pug template:

```pug
p It is #{places.getRank(place, "pop_2021").describe("largest")} area.
```

### MagicArray.add

```js
places.add(rows)
```

Returns a copy with one row or an array of rows added, skipping rows whose code is already present.

```js
places.add(data.get("North East")).length; // 6
```

### MagicArray.remove

```js
places.remove(rows)
```

Returns a copy without one row or an array of rows (matched by code).

```js
places.remove(place).toList("areanm");
// "Middlesbrough, Redcar and Cleveland, Stockton-on-Tees and Darlington"
```

### MagicArray.trim

```js
places.trim(n)
```

Keeps the first `n` rows, or the last `n` if `n` is negative.

```js
places.trim(2).toList("areanm"); // "Hartlepool and Middlesbrough"
places.trim(-2).toList("areanm"); // "Stockton-on-Tees and Darlington"
```

### MagicArray.flip

```js
places.flip()
```

Returns a reversed copy.

```js
places.flip().toList("areanm");
// "Darlington, Stockton-on-Tees, Redcar and Cleveland, Middlesbrough and Hartlepool"
```

### MagicArray.toList

```js
places.toList(key, separator = [", ", " and "])
```

Joins one column into a list. See [toList](#tolist).

```js
places.trim(3).toList("areanm"); // "Hartlepool, Middlesbrough and Redcar and Cleveland"
places.trim(3).toList("areanm", [", ", " or "]); // "Hartlepool, Middlesbrough or Redcar and Cleveland"
```

### MagicArray.toData

```js
places.toData(props, mode = null)
```

Converts the rows into data for a chart. See [toData](#todata).

### MagicArray.refreshProps

```js
places.refreshProps()
```

Re-detects `codeKey`, `nameKey` and `parentKey` and rebuilds `lookup`, clearing any values you have set. This happens automatically when rows are added or removed, but not when a row is replaced in place (eg. `places[0] = row`).

## MagicObject

A data row, as returned by [csvParse](#csvparse). Its values are available as properties (`place.areanm`, `place.pop_2021`), plus these methods.

### MagicObject.getName

```js
place.getName(context = null, mode = "default")
```

Returns the place's name, formatted for its context. See [formatName](#formatname).

```js
place.getName(); // "Hartlepool"
place.getName("in"); // "in Hartlepool"
data.get("North East").getName("in"); // "in the North East"
```

### MagicObject.getCode

```js
place.getCode(); // "E06000001"
```

### MagicObject.getParent

Returns the parent area's code, from a column named `parentcd`, `parent`, `regioncd` or `region`.

```js
place.getParent(); // "E12000001"
```

### MagicObject.getCountry

Returns the country code, based on the first letter of the place's code (E, N, S or W).

```js
place.getCountry(); // "E92000001"
```

### MagicObject.highest

```js
place.highest(keys)
```

Returns the name of the column, from `keys`, with the highest value. Missing and non-numeric values are skipped; ties go to the first key.

```js
place.highest(["pop_2011", "pop_2021"]); // "pop_2021"
```

Pair it with a lookup of labels to use it in text:

```js
const labels = { pop_2011: "2011", pop_2021: "2021" };
labels[place.highest(["pop_2011", "pop_2021"])]; // "2021"
```

### MagicObject.lowest

```js
place.lowest(keys)
```

Like [highest](#magicobjecthighest), for the lowest value.

```js
place.lowest(["pop_2011", "pop_2021"]); // "pop_2011"
```

### MagicObject.toData

```js
place.toData(props, mode = null)
```

Converts this row into chart data. See [toData](#todata).

```js
place.toData({ x: "pop_2021", y: "areanm" }); // [{ x: 92338, y: "Hartlepool" }]
```

## MagicNumber

A `Number` with formatting methods. [csvParse](#csvparse) turns every numeric value into a `MagicNumber`. Each method calls the function with the same name:

| Method                                 | Same as                                                 |
| -------------------------------------- | ------------------------------------------------------- |
| `value.format(str, si)`                | [format](#format)`(value, str, si)`                     |
| `value.round(dp)`                      | [round](#round)`(value, dp)`                            |
| `value.abs()`                          | [abs](#abs)`(value)`                                    |
| `value.approx(sf, options)`            | [approx](#approx)`(value, sf, options)`                 |
| `value.toWords(type, options)`         | [toWords](#towords)`(value, type, options)`             |
| `value.toFraction(mode, denominators)` | [toFraction](#tofraction)`(value, mode, denominators)`  |
| `value.describeChange(to, options)`    | [describeChange](#describechange)`(value, to, options)` |
| `value.compareTo(ref, options)`        | [compareTo](#compareto)`(value, ref, options)`          |

```js
place.pop_2021.format(); // "92,338"
place.pop_2021.approx(); // "just over 92,000"
place.pc_degree.toFraction(); // "one in five"
place.pop_2011.describeChange(place.pop_2021); // "increased by 0.3%"
place.pc_degree.compareTo(data.get("England").pc_degree); // "lower than"
```

## Numbers

### format

```js
format(value, str = ",", si = "long")
```

Formats a number with a [d3-format](https://d3js.org/d3-format) string, using `£` for the `$` currency symbol. It adds two things:

- **Negative precision** with `f`, to round to tens, hundreds etc: `",.-2f"` rounds to the nearest hundred.
- **SI units in words** with `s`: `"long"` (default) gives "thousand", "million", "billion" and "trillion"; `"short"` gives "mn", "bn" and "tn".

```js
format(1234.567, ",.2f"); // "1,234.57"
format(1234.567, ",.-2f"); // "1,200"
format(1234567, ".3s"); // "1.23 million"
format(1234567, ".3s", "short"); // "1.23mn"
format(1234567000, ".2s"); // "1.2 billion"
format(1234.5, "$,.2f"); // "£1,234.50"
format(0.123, ".1%"); // "12.3%"
format(-1234); // "−1,234" (with a minus sign, not a hyphen)
```

### round

```js
round(value, dp)
```

Rounds to `dp` decimal places. A negative `dp` rounds to tens, hundreds etc. Returns a plain number; the [MagicNumber](#magicnumber) method `value.round(dp)` returns a `MagicNumber`, so it can be chained.

```js
round(123.4567, 2); // 123.46
round(123.4567, -2); // 100
place.pop_2021.round(-3).format(); // "92,000"
```

### abs

```js
abs(value)
```

Returns the absolute value as a [MagicNumber](#magicnumber).

```js
abs(-5).format(); // "5"
```

### approx

```js
approx(value, sf = 2, options = {})
```

Rounds to `sf` significant figures and adds a hedge word. Millions and above are written in words.

```js
approx(5.97); // "almost 6"
approx(1234); // "just over 1,200"
approx(1030000); // "just over 1 million"
approx(1520000000); // "just over 1.5 billion"
approx(46, 1); // "around 50"
approx(6); // "6" (exact, so no hedge)
```

Options:

- `texts`: the hedge words for below, far from and above the rounded value. Default `["almost", "around", "just over"]`.
- `threshold`: how far (as a proportion) the value can be from the rounded value before `texts[1]` is used. Default `0.05`.

```js
approx(5.97, 2, { texts: ["just under", "about", "just over"], threshold: 0.001 }); // "about 6"
```

### toWords

```js
toWords(value, type = "cardinal", options = { threshold: 9, dropFirst: false })
```

Writes a number in words, following the ONS style of words for one to nine and figures for 10 and above.

- `type`: `"cardinal"` (five) or `"ordinal"` (fifth).
- `threshold`: the largest number written in words. `-1` means always use words.
- `dropFirst`: for ordinals, return `""` for 1. Useful for phrases like "the [second] largest".

```js
toWords(5); // "five"
toWords(15); // "15"
toWords(15, "cardinal", { threshold: 20 }); // "fifteen"
toWords(2500, "cardinal", { threshold: -1 }); // "two thousand, five hundred"
toWords(2, "ordinal"); // "second"
toWords(21, "ordinal"); // "21st"
toWords(1, "ordinal", { dropFirst: true }); // ""
```

### toFraction

```js
toFraction(value, mode = "in", denominators = [2, 3, 4, 5, 10])
```

Describes a proportion between 0 and 1 as the nearest simple fraction. With `mode = "fraction"`, it uses fraction words. Proportions smaller than the smallest fraction are always "one in x". Returns `""` for values outside 0 to 1.

```js
toFraction(0.21); // "one in five"
toFraction(0.66); // "two in three"
toFraction(0.7); // "seven in 10"
toFraction(0.05); // "one in 20"

toFraction(0.21, "fraction"); // "a fifth"
toFraction(0.5, "fraction"); // "half"
toFraction(0.66, "fraction"); // "two-thirds"
toFraction(0.75, "fraction"); // "three-quarters"
```

Combine it with a hedge word in text: `around #{place.pc_degree.toFraction()}`.

## Change, comparison and rank

### describeChange

```js
describeChange(from, to, options = {})
```

Describes the change from one value to another. Returns `""` if either value is missing.

```js
describeChange(100, 105.2); // "increased by 5.2%"
describeChange(100, 94); // "decreased by 6.0%"
describeChange(100, 100.01); // "was unchanged" (rounds to 0.0%)
describeChange(1000, 2200, { type: "absolute" }); // "increased by 1,200"
describeChange(21.3, 24.8, { type: "pp" }); // "increased by 3.5 percentage points"
```

Options:

- `type`: `"percent"` (default) for the percentage change, `"absolute"` for the difference, or `"pp"` for the difference in percentage points.
- `str`: a [format](#format) string for the amount. Default `".1f"`, or `","` for `"absolute"`.
- `texts`: words for an increase, a decrease and no change. Default `["increased", "decreased", "was unchanged"]`.
- `threshold`: changes this small or smaller count as no change. Default `0`.

```js
describeChange(100, 112.34, { str: ".0f", texts: ["rose", "fell", "was unchanged"] }); // "rose by 12%"
describeChange(100, 100.5, { threshold: 1, texts: ["rose", "fell", "was broadly unchanged"] });
// "was broadly unchanged"
```

### compareTo

```js
compareTo(value, ref, options = {})
```

Compares a value with a reference value, such as an average.

- `threshold`: values within this proportion of `ref` count as the same. Default `0`.
- `texts`: default `["higher than", "the same as", "lower than"]`.

```js
compareTo(105, 100); // "higher than"
compareTo(100, 100); // "the same as"
compareTo(103, 100, { threshold: 0.05 }); // "the same as"
compareTo(103, 100, { threshold: 0.05, texts: ["higher than", "similar to", "lower than"] }); // "similar to"
```

### describeRank

```js
describeRank(rank, label = "highest", tied = false)
```

Describes a rank in words. To work out the rank and ties from data, use [MagicArray.getRank](#magicarraygetrank), which returns a rank with a `describe()` method that calls this function.

```js
describeRank(1); // "the highest"
describeRank(2); // "the second highest"
describeRank(12); // "the 12th highest"
describeRank(3, "largest", true); // "the joint third largest"
```

### moreLess

```js
moreLess(diff, texts = ["more", "less", "same"])
```

Picks a word based on whether a difference is positive, negative or zero.

```js
moreLess(5); // "more"
moreLess(-5); // "less"
moreLess(0); // "same"
moreLess(5, ["higher", "lower", "the same"]); // "higher"
```

### breaksToWords

```js
breaksToWords(value, breaks = [0], texts = ["less", "more"], quantifier = null)
```

Picks a word based on where a value falls between break points. `texts` needs one more item than `breaks`. With a `quantifier`, a value exactly on a break point gets the quantifier before the text for the range next to it.

```js
breaksToWords(-1); // "less"
breaksToWords(5, [4, 6], ["less", "about the same", "more"]); // "about the same"
breaksToWords(7, [4, 6], ["less", "about the same", "more"]); // "more"
breaksToWords(6, [4, 6], ["less", "about the same", "more"], "roughly"); // "roughly about the same"
```

## Text

### toList

```js
toList(array, key, separator = [", ", " and "])
```

Joins items into a list. `key` is a property name, a function, or `null` for an array of strings. `separator` is either `[between, last]` or a single string.

```js
toList(["red", "green", "blue"]); // "red, green and blue"
toList(["red", "green", "blue"], null, [", ", " or "]); // "red, green or blue"
toList([{ name: "A" }, { name: "B" }], "name"); // "A and B"
places.toList((d) => d.areanm.toUpperCase()); // "HARTLEPOOL, MIDDLESBROUGH, … and DARLINGTON"
```

### aAn

```js
aAn(str, mode = "default")
```

Adds "a" or "an" before a word. Any other `mode` returns just the article.

```js
aAn("apple"); // "an apple"
aAn("hour"); // "an hour"
aAn("European"); // "a European"
aAn("apple", "article"); // "an"
```

### capitalise

```js
capitalise("north west"); // "North west"
```

### pluralise

```js
pluralise(str, count, inclusive = false)
```

Returns the plural of a word, or the singular if `count` is 1. With `inclusive`, the count is included.

```js
pluralise("person"); // "people"
pluralise("person", 1); // "person"
pluralise("person", 3, true); // "3 people"
```

### singularise

```js
singularise("people"); // "person"
```

## Place names and codes

### formatName

```js
formatName(name, context = null, mode = "default")
```

Formats a place name for use in a sentence. It adds "the" where needed (regions, the United Kingdom, Derbyshire Dales, and names starting "City of", "Vale of" or "Isle"), replaces "&" with "and", and drops ", City of" and ", County of".

`context` can be:

- `null`: the name on its own.
- `"the"`: with "the" if needed.
- `"in"`: with "in" (or "on" for islands).
- `"its"`: possessive.

Any `mode` other than `"default"` returns only the prefix.

```js
formatName("North West"); // "North West"
formatName("North West", "the"); // "the North West"
formatName("North West", "in"); // "in the North West"
formatName("Isle of Wight", "in"); // "on the Isle of Wight"
formatName("London", "its"); // "London's"
formatName("Derbyshire Dales", "its"); // "the Derbyshire Dales'"
formatName("Kingston upon Hull, City of"); // "Kingston upon Hull"
formatName("Brighton & Hove"); // "Brighton and Hove"
formatName("East"); // "East of England"
formatName("North West", "in", "prefix"); // "in the"
```

### getName

```js
getName(place, context = null, mode = "default")
```

[formatName](#formatname) for a row's name column. Same as [MagicObject.getName](#magicobjectgetname).

```js
getName(place, "in"); // "in Hartlepool"
```

### getCode

```js
getCode(place); // "E06000001"
```

### getParent

```js
getParent(place); // "E12000001"
```

### getCodeKey, getNameKey, getParentKey

```js
getCodeKey(row)
getNameKey(row)
getParentKey(row)
```

Return the name of the column holding a row's code, name or parent code:

- **Code:** `areacd`, `code` or `id`, then a column ending `code`, then one ending `cd`, then the first column.
- **Name:** `hclnm`, `areanm`, `name` or `label`, then a column ending `name`, then one ending `nm`, then `areacd`, then the first column.
- **Parent:** `parentcd`, `parent`, `regioncd` or `region`, otherwise `null`.

Matching ignores case.

```js
getCodeKey(place); // "areacd"
getNameKey(place); // "areanm"
getParentKey(place); // "parentcd"
```

## Dates

Dates can be given as a `Date`, a date string (`"2024-03-04"`) or a year (`2024`). They are formatted in UTC, to match the dates [csvParse](#csvparse) creates from date-only values.

### formatDate

```js
formatDate(date, unit = "day")
```

Formats a date in ONS style. `unit` is `"day"`, `"month"` or `"year"`.

```js
formatDate("2024-03-04"); // "4 March 2024"
formatDate("2024-03-04", "month"); // "March 2024"
formatDate(2024, "year"); // "2024"
```

### formatPeriod

```js
formatPeriod(start, end, unit = "year")
```

Formats a period in ONS style, without repeating the year or month where they are the same.

```js
formatPeriod(2010, 2020); // "2010 to 2020"
formatPeriod("2024-01-01", "2024-03-01", "month"); // "January to March 2024"
formatPeriod("2023-12-01", "2024-02-01", "month"); // "December 2023 to February 2024"
formatPeriod("2024-03-04", "2024-03-15", "day"); // "4 to 15 March 2024"
formatPeriod("2024-03-04", "2024-06-15", "day"); // "4 March to 15 June 2024"
```

## Chart data

### toData

```js
toData(rows, props, mode = null)
```

Converts rows into an array of objects for a chart. `props` maps each output key to a column:

- **A column name** copies that column.
- **An array of column names** creates one output object per column (eg. one per year).
- **An array of labels** (that aren't column names) supplies a value for each of those objects.

```js
places.top("pop_2021", 2).toData({ x: "pop_2021", y: "areanm" });
// [{ x: 196595, y: "Stockton-on-Tees" }, { x: 143924, y: "Middlesbrough" }]

places.top("pop_2021", 2).toData({ x: ["2011", "2021"], y: ["pop_2011", "pop_2021"], z: "areanm" });
// [
//   { z: "Stockton-on-Tees", x: "2011", y: 191610 },
//   { z: "Stockton-on-Tees", x: "2021", y: 196595 },
//   { z: "Middlesbrough", x: "2011", y: 138412 },
//   { z: "Middlesbrough", x: "2021", y: 143924 }
// ]
```

The result is an array that converts to a JSON string when it is output, so `prop.data= places.toData(...)` works in a Pug template. Calling an array method on the result (eg. `.slice()`) loses this. `mode` can also be `"stringify"` to return a JSON string, or `"protect"` to return one wrapped in `§` characters.

## Templates

### renderJSON

```js
renderJSON(template, place, places, lookup, pug = window.pug)
```

Renders a [Pug](https://pugjs.org) template for one place and converts the HTML into JSON for a front end to display. `place` can be `null` (for example, a default page with no area selected). Pass the Pug library as `pug` when not running in a browser with Pug loaded.

Templates have access to `place`, `places`, `lookup`, `MagicArray` and every function on this page. `row` and `rows` are aliases for `place` and `places`.

The HTML is converted like this:

- Each top-level `section` becomes an object in `sections`, with its `id`, its `class` (as `type`) and its HTML (as `content`). A template without sections becomes one section. Nested sections become `sections` within their parent.
- Each `prop.name` element becomes a `name` field. Text containing `|` becomes an array. `prop.data` is parsed as JSON.
- `mark` tags with a `background-color` get a black or white text `color` for contrast.
- Top-level `//` comments become `notes` (`//-` comments are left out).

If the template throws an error, `sections` is empty and the message is returned as `error`. The output also includes `place`, and the parent (`region`) and country (`ctry`) rows from `lookup`.

```pug
// Version 1.0
section#intro
  h2 Population #{place.getName("in")}
  p The population of #{place.getName()} #{place.pop_2011.describeChange(place.pop_2021)} between 2011 and 2021, to #{place.pop_2021.approx()}.
  p It is #{places.getRank(place, "pop_2021").describe("largest")} local authority in the region.
section#chart
  prop.title Largest local authorities #{lookup[place.parentcd].getName("in")}
  prop.data= places.top("pop_2021", 3).toData({x: "pop_2021", y: "areanm"})
```

```js
import pug from "pug";
renderJSON(template, place, places, data.lookup, pug);
```

```json
{
	"sections": [
		{
			"id": "intro",
			"content": "<h2>Population in Hartlepool</h2><p>The population of Hartlepool increased by 0.3% between 2011 and 2021, to just over 92,000.</p><p>It is the fifth largest local authority in the region.</p>"
		},
		{
			"id": "chart",
			"title": "Largest local authorities in the North East",
			"data": [
				{ "x": 196595, "y": "Stockton-on-Tees" },
				{ "x": 143924, "y": "Middlesbrough" },
				{ "x": 136531, "y": "Redcar and Cleveland" }
			]
		}
	],
	"place": { "areacd": "E06000001", "areanm": "Hartlepool", "…": "…" },
	"region": { "areacd": "E12000001", "areanm": "North East", "…": "…" },
	"ctry": { "areacd": "E92000001", "areanm": "England", "…": "…" },
	"notes": ["Version 1.0"]
}
```

## Sorting

### ascending, descending

```js
ascending(a, b)
descending(a, b)
```

Comparison functions for `Array.sort()`. Numbers (including [MagicNumbers](#magicnumber)), dates and booleans come first, then text, then missing values (`null`, `undefined`, `NaN` and `""`). These groups are in the same order whichever way the values are sorted, so text like `"NA"` in a column of numbers always goes after the numbers. Text is sorted by character code, as with `<`, so capital letters come before lower-case ones.

```js
[3, 1, 2].sort(ascending); // [1, 2, 3]
[3, 1, 2].sort(descending); // [3, 2, 1]
[3, null, 1, "NA", 2].sort(descending); // [3, 2, 1, "NA", null]
```
