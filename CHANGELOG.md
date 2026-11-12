# Changelog

Changes that affect templates or code using this library. Functions are documented in the [API reference](docs/api.md).

## 0.6.3 (unreleased)

### Changes

- **Sorting, `top()`, `bottom()`, `between()` and `getRank()` handle missing values and text consistently.** Data with no missing values gives the same results as before.
    - `ascending` and `descending` (and `sortBy()`, `.ascending()` and `.descending()`) put numbers first, then text (eg. `"NA"`), then missing values (`null`, `NaN` and empty cells), in either order. Previously, any missing value in a column could leave the whole column in the wrong order. `ascending(null, 1)` is now `1` (it was `NaN`).
    - `top()`, `bottom()` and `between()` leave out rows with missing values, and text in a column of numbers. Previously, they could return these rows, and some of the top or bottom rows could be missing from the results.
    - `getRank()` returns `null` for a row with a missing value or text. Previously, text like `"NA"` was ranked 1 and a missing value was ranked last. Other rows' ranks are unchanged.

### New

- `MagicArray`s have `columns`, like `csvParse()` arrays. `MagicArray.from(csvParse(csv)).columns` keeps the CSV's column names and order, including after `.filter()`, `.slice()` and methods like `sortBy()` and `top()`. An array made from rows without `columns` uses the keys of its first row.
- `top()` and `bottom()` have a `ties` option (`places.top(key, 3, null, true)`) that also includes rows tied with the last one. With `ties`, the result is always an array.

## 0.6.2

### Changes

- **`csvParse()` removes blank rows from the end of the data**, with a console warning, instead of returning them as rows of empty cells (`null` with the default `autoType`). Blank rows elsewhere in the file are kept.

### New

- `validateCSV(str)` checks a CSV string for blank rows, rows with no code, duplicate codes and columns with mixed types, and returns a report object. It runs the same checks as the `check-data.js` script in robo-article, robo-embed and robo-scrolly.

## 0.6.1

### Changes

- **Code and name columns are detected in a slightly different order.** `getCodeKey()` and `getNameKey()` (also used by `MagicArray`, `getName()` and `getCode()`) now look for columns ending `code` and `name` (eg. `lad_name`), and only use `areacd` as the name column if there's no column ending `name` or `nm`. Previously `{ areacd, lad21nm }` used `areacd` as the name.

## 0.6.0

Changes since 0.4.0. (0.5.0 was a test release and shouldn't be used.)

### Breaking changes

- **`renderHTML()` has been removed.** Use `renderJSON()`.
- **`renderJSON()` no longer changes Pug's text.** It used to remove spaces before `%` and `pp` and after `£`, `€` and `$`, and add a space after closing `strong`, `em`, `mark`, `span`, `a`, `b` and `i` tags. These fixes were for RosaeNLG. As a result:
    - `content` no longer has double spaces after inline tags.
    - Pug joins a tag on its own line to a following `| text` line without a space. Use inline tags (`#[strong 5] people`) or start the `|` line with a space.
- **`renderJSON()` output can include `notes`.** Top-level Pug `//` comments (not `//-`) are now returned as `notes`, as originally intended. Front ends that don't expect the key can ignore it.
- **`toData()` returns an array that converts itself to JSON**, instead of `renderJSON()` rewriting `.toData(...)` calls in the template source. `prop.data= places.toData(...)` works as before, and now also works at the end of a file, with trailing spaces, and with props in a variable. In templates, `toData()` results can now be used as arrays (eg. `each d in places.toData(...)`). Calling an array method on the result (eg. `.toData(...).slice(0, 3)`) gives a `prop.data is not valid JSON` error.
- **`getRank()` counts tied values as equal.** Two rows tied for first are both ranked 1, and the next is ranked 3. Previously, rows parsed from CSV with tied values got different ranks (1 and 2), depending on their order. The result is still a `MagicNumber`, so `getRank(...).toWords("ordinal")` works as before, and it now also has `isTied`, `ties` and `describe()` (see [getRank](docs/api.md#magicarraygetrank)). Results only change where values are tied.
- **Empty `_array` cells are `[]`, not `null`.** Columns ending `_array` are now always arrays, including single values (`"2020"` becomes `["2020"]`). Template checks like `if row.tags_array` should become `if row.tags_array.length`.
- **`language` is no longer available in templates.** It was left over from RosaeNLG.
- Documentation has moved from the README to [docs/api.md](docs/api.md).

### New

- `describeChange(from, to, options)`: "increased by 5.2%", "decreased by 1,200", "increased by 3.5 percentage points"
- `approx(value, sf, options)`: "almost 6", "just over 1 million"
- `toFraction(value, mode)`: "one in five", "two-thirds"
- `describeRank(rank, label, tied)`: "the joint third largest"
- `formatDate(date, unit)` and `formatPeriod(start, end, unit)`: "4 March 2024", "January to March 2024"
- `compareTo(value, ref, options)`: "higher than", "the same as", "lower than"
- `getRank()` results have `isTied`, `ties` and `describe(label)`, eg. `places.getRank(place, "population").describe("largest")`
- `MagicNumber` methods: `approx()`, `toFraction()`, `compareTo()`, `describeChange()`

### Fixes

- `MagicArray.get()` and `lookup` now work on arrays returned by `filterBy`, `remove`, `top`, `bottom`, `trim`, `add` and built-in methods like `.filter()`, and update when rows are added or removed.
- `getCodeKey()` and `getNameKey()` returned a lowercased column name for uppercase columns that aren't one of the preferred names (eg. `LAD21CD`, `LAD21NM`), so `getName()` threw an error and `getCode()` and `.get()` returned `undefined`.
- `filterBy()` matches numeric values (eg. `filterBy("value", 5)`).
- `toList()` works on arrays of strings without a key.
- `round()` and `MagicNumber.round()` work on numbers parsed from CSV. `MagicNumber.round()` returns a `MagicNumber`.
- `"NaN"` cells are parsed as a `MagicNumber`.
- `renderJSON()`:
    - `|`-separated props are unescaped (`A & B`, not `A &amp; B`).
    - `prop.data` strings containing numbers and spaces are no longer changed (`"Top 10 2020"` was becoming `"Top 102020"`).
    - `mark` tags with an unparseable colour, other styles or no space after `background-color:` no longer break the render. Marks with their own text `color` are left alone.
    - A plain object `place` or a `null` lookup no longer throws an error.

### Development

- Tests now use Vitest 5, which needs Node 22.12 or later.
