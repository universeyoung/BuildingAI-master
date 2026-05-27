---
name: xlsx
description: "Comprehensive spreadsheet creation, editing, and analysis with support for formulas, formatting, data analysis, and visualization. Use when working with spreadsheets (.xlsx, .xlsm, .csv, .tsv, etc) for: (1) Creating new spreadsheets with formulas and formatting, (2) Reading or analyzing data, (3) Modify existing spreadsheets while preserving formulas, (4) Data analysis and visualization in spreadsheets, or (5) Recalculating formulas"
enabled: true
---

# Requirements for Outputs

## All Excel files

### Zero Formula Errors
Every Excel model MUST be delivered with ZERO formula errors (#REF!, #DIV/0!, #VALUE!, #N/A, #NAME?).

### Recommended Fonts
openpyxl's default `Calibri` has no CJK glyphs, so Chinese cells fall back to SimSun (宋体). Set a CJK-capable font explicitly and override the workbook default:

| Use case | Font |
|---|---|
| Cross-platform default (CJK) | `Microsoft YaHei` |
| macOS-native | `PingFang SC` |
| English-only modern | `Inter` / `Aptos Narrow` |

```python
wb._named_styles['Normal'].font = Font(name='Microsoft YaHei', size=11)
```

### Preserve Existing Templates (when updating templates)
- Study and EXACTLY match existing format, style, and conventions when modifying files.
- Existing template conventions ALWAYS override these guidelines.

## Theme catalogue

Use one `theme=` value across all `build_table` / `build_chart` calls in a workbook — mixing themes looks stitched-together. Pick by audience and content type:

| `theme=` | Best for | Look |
|---|---|---|
| `modern_finance` *(default)* | Financial models, IR / earnings decks, valuation memos | Navy + orange accent, grey banding |
| `executive_report` | Board / annual / monthly executive reviews | Claret + antique gold on cream |
| `vibrant_marketing` | Growth, campaign, sales / consumer KPI decks | Bright blue + orange + teal/magenta |
| `tech_product` | Engineering, SaaS, product analytics, A/B test reports | Dark indigo + cyan, cool greys |
| `data_dense` | 10+ column research tables, ops trackers, raw data exports | 10 pt font, tight banding, 8-colour palette |
| `minimal_grey` | Editorial reports, white-paper appendices | Pure greyscale |
| `print_friendly` | B&W print output: legal exhibits, regulatory filings, hand-outs | Black header, neutral greys only |

# XLSX creation, editing, and analysis

## Overview
A user may ask you to create, edit, or analyze an .xlsx file. Choose the tool by task:
- **pandas**: data analysis, bulk operations, simple export.
- **openpyxl**: formulas, low-level cell formatting, workbook surgery.
- **`scripts/builders.py`** (`build_table` / `build_chart`): every deliverable table and chart — see *Building Tables and Charts*.

## CRITICAL: Use Formulas, Not Hardcoded Values
**Always use Excel formulas instead of calculating in Python and hardcoding the result.** This keeps the workbook dynamic.

```python
# ❌ WRONG — hardcoded result
sheet['B10'] = df['Sales'].sum()           # bakes in 5000
sheet['C5']  = (last - first) / first      # bakes in 0.15

# ✅ CORRECT — Excel evaluates
sheet['B10'] = '=SUM(B2:B9)'
sheet['C5']  = '=(C4-C2)/C2'
sheet['D20'] = '=AVERAGE(D2:D19)'
```

Applies to ALL totals, ratios, percentages, differences, etc.
This rule holds inside `build_table` too — pass `'=...'` strings in `data` and they are written as live formulas (see *Tables — `build_table`*).

## Common Workflow (mandatory before delivery)

Every step after **Save** is a separate QA pass — they catch different defect classes (formula correctness, structural lint). Skipping any of them has reliably produced shipped defects.

1. **Choose tool**: pandas for data; openpyxl for formulas; **`build_table` / `build_chart` (from `scripts/builders.py`) for every deliverable table or chart** — see *Building Tables and Charts* below.
2. **Create / Load** workbook.
3. **Build / Modify**: data, formulas, formatting, charts.
4. **Polish (optional)**: group coloring, conditional highlights, data bars, ...
5. **Save** to file.
6. **Recalc formulas** (MANDATORY if any formulas):
   ```bash
   python scripts/recalc.py output.xlsx
   # If soffice is missing → fallback (preserves formulas, sets fullCalcOnLoad):
   python scripts/recalc_fallback.py output.xlsx
   ```
   If returned `status` is `errors_found`, fix cells in `error_summary` and re-run.
7. **Verify workbook structure**:
   ```bash
   python scripts/verify_workbook.py output.xlsx
   ```
   Catches what recalc cannot see: per-point chart series, missing categories, blank X-axis, `chart.style` overrides, naked y-axis scaling, heavy default gridlines, unstyled headers, CJK font gaps. **All `errors` MUST be 0** before delivery.

## Building Tables and Charts

### Use standard API, not raw openpyxl

- **ALL deliverable tables and charts MUST be anchored by `build_table` / `build_chart` from `scripts/builders.py`.** 
- Add extra polish (group coloring, conditional highlights, data bars, ...) via the helpers from `scripts/style_kit.py` (see *Polishing tables (optional)* below)
- Raw `BarChart()` / `Reference()` / per-cell `Font()` is reserved for cases no builder or helper covers, and requires a one-line justification comment.

Why this is non-negotiable: openpyxl exposes ~30 axis / series / gridline / tick / legend attributes, each silently defaulting to a 2007-era preset. Models that touch them piecemeal lint OK but ship charts that look like a Python data dump (heavy navy gridlines, blank X axis, legend overlapping bars). The builder bakes correct defaults at creation time; `verify_workbook.py` (CH010-CH018) catches anything that escapes.

### Tables — `build_table`
```python
from builders import build_table

t = build_table(
    ws,
    data=df,                         # pandas.DataFrame OR list[list] (first row = header)
    anchor='A1',                     # top-left cell; default 'A1' — see Anchor note below
    title='Revenue Breakdown by Segment',  # optional banner row ABOVE header (merged across width)
    title_height=28,                 # banner row height in px (only used when title is set)
    theme='modern_finance',          # bundled palette + fonts; see Theme catalogue above
    column_formats={                 # column-name → NUMFMT key; unknown keys raise ValueError
        'Revenue ($mm)': 'dollar', 'Margin': 'pct_1',
    },
    total_row=True,                  # append a SUM row over numeric columns
    band_rows=True,                  # alternate-row light fill
    auto_width=True,                 # set column widths from longest cell content (CJK = 2 chars)
)
# Returned handle (use these — never hand-build A1 strings for the chart):
# t = {'title_row': 1, 'header_row': 2, 'data_rows': (3, 10), 'total_row': 11,
#      'columns': {'Quarter': 'A', 'Revenue': 'B', ...}, 'sheet': 'Data'}
```

> Default `anchor='A1'` is right for a single table per sheet; only offset for true multi-region layouts (dashboards, side-by-side tables).
> Use `title=` for the banner — Do NOT use `ws.insert_rows(1) + ws['B1']='…'` to add a title afterwards: it leaves the cell un-merged and clipped.
> `column_formats` keys are exact-match against DataFrame column names.
> **Formulas:** any cell in `data` whose value is a string starting with `=` (e.g. `'=(B2-C2)/B2'`) is written as a live formula. `total_row=True` already emits `=SUM(...)` automatically.

### Charts — `build_chart`
```python
from builders import build_chart

build_chart(
    ws,
    kind='combo_bar_line',           # 'clustered_bar' | 'stacked_bar' | 'line' | 'area' | 'combo_bar_line'
    data_range=f"Data!A{t['header_row']}:D{t['data_rows'][1]}",
                                     # str (single rect) OR list[str] for non-contiguous columns —
                                     # rect #0 = categories, rest = series
    series_orient='cols',            # 'cols' = each column is a series; 'rows' = each row
    title='Revenue and margin ($mm)',  # put units here — keep show_axis_titles=False
    anchor='G2',
    size=(720, 360),                 # px; use the SAME size for every chart in a sheet for visual harmony
    theme='modern_finance',
    legend='bottom',                 # 'bottom' | 'right' | 'none'
    gridlines='horizontal_dashed',   # 'none' | 'horizontal_dashed' | 'horizontal_solid'
    y_axis_min='zero',               # 'zero' | 'auto_tight' | <number> — see Choosing y_axis_min
    y_number_format=None,            # NUMFMT key; None → infer ('pct_1' if data ∈ [-1,1] else 'int')
    bar_gap_width=80,                # bar/clustered_bar only: gap as % of bar width
    line_smooth=False,               # line/combo only: smoothed series
    line_markers=True,               # line/combo only: draw circle markers on points
    show_axis_titles=False,          # leave False; bottom legend collides with axis titles (CH011)
    combo_line_series=None,          # combo_bar_line only: int or list of series indices to draw as line
                                     #   (defaults to the LAST series); other series become bars
)
```

### Non-contiguous data ranges

For non-adjacent columns (e.g. cats in `A`, series in `J:K`), pass `data_range` as a list — rect #0 = categories, rest = series. Same sheet, matching row span (or column span when `series_orient='rows'`).

```python
data_range=[f"'业务分部'!A{t['header_row']}:A{t['data_rows'][1]}",
            f"'业务分部'!J{t['header_row']}:K{t['data_rows'][1]}"]
```

### Choosing `kind`

| `kind=` | Shape | Use for |
|---|---|---|
| `clustered_bar` | Side-by-side vertical bars per category | Comparing a few series across categories |
| `stacked_bar` | Bars segmented into stacked parts summing to total | Part-to-whole over categories |
| `line` | Connected points across an ordered axis | Trends over time |
| `area` | Filled regions stacked under lines | Cumulative trends, composition over time |
| `combo_bar_line` | Bars plus an overlaid line on a secondary axis | Mixed magnitude + rate (e.g. revenue + margin %) |

### Choosing `y_axis_min`

| Data shape | Use | Why |
|---|---|---|
| Revenue / cost / count (cross-comparison) | `'zero'` | Bars must share a zero baseline for fair area comparison. |
| Growth %, margin %, ratio, stock price, index | `'auto_tight'` | Otherwise small swings flatten against a huge zero-baseline gap. |
| Mixed (combo) | `'zero'` for primary axis; `'auto_tight'` on the secondary | Keep primary fair; let secondary breathe. |

If you see CH017 (`y axis pinned at 0 but data sits in the top 1/5`), switch to `'auto_tight'`.

### Polishing tables (optional)

Layer extra visual structure on top of `build_table` by calling these helpers from `style_kit.py`. All take the handle `t` returned by `build_table` and address columns by name — never hand-build A1 ranges.

| Helper | Effect | Key args |
|---|---|---|
| `color_column_groups(ws, t, groups=...)` | Tint contiguous column groups (preserves banding) | `groups=[{'columns':[...], 'tint': 'mint'}, ...]` — tints: `mint` `sky` `peach` `lavender` `butter` `rose` `slate` `sand` |
| `highlight_cells(ws, t, rules=...)` | Per-cell emphasis when a threshold is met | `rules=[{'column':..., 'when':'lt'/'le'/'gt'/'ge'/'eq'/'ne'/'between', 'value':..., 'style':...}]` — styles: `red_text` `green_text` `amber_text` `red_fill` `green_fill` `amber_fill` `bold` |
| `add_data_bars(ws, t, columns=..., color=...)` | In-cell horizontal bars (Excel native) | `color`: `sky` `mint` `peach` `rose` `lavender` `slate` |
| `add_color_scale(ws, t, columns=..., scale=...)` | Heatmap fill across a column | `scale`: `red_white_green` `green_white_red` `white_blue` `white_red` |
| `add_icon_set(ws, t, columns=..., icon_set=...)` | Directional icons next to values | `icon_set`: `3_arrows` `3_traffic` `3_symbols` `3_flags` `5_arrows` `5_quarters` |
| `add_column_separators(ws, t, after_columns=[...])` | Vertical divider on the right edge of each named column | Use to mark business-section boundaries |

Standard recipe — apply in this order so later layers overwrite earlier ones cleanly:

```python
from style_kit import (color_column_groups, highlight_cells,
                      add_data_bars, add_column_separators)

t = build_table(ws, data=df, theme='modern_finance', column_formats={...})

color_column_groups(ws, t, groups=[
    {'columns': ['Operating Margin', 'Net Margin', 'FCF Margin'], 'tint': 'mint'},
    {'columns': ['CapEx Intensity', 'Cloud Revenue Mix'],         'tint': 'sky'},
    {'columns': ['Ads Revenue Mix', 'Search Share of Ads'],       'tint': 'peach'},
])
highlight_cells(ws, t, rules=[
    {'column': 'Revenue QoQ', 'when': 'lt', 'value': 0,    'style': 'red_text'},
    {'column': 'FCF Margin',  'when': 'lt', 'value': 0.10, 'style': 'red_fill'},
])
add_data_bars(ws, t, columns=['CapEx Intensity'], color='sky')
add_column_separators(ws, t, after_columns=['Revenue QoQ', 'FCF Margin'])
```

Note: Skip these helpers entirely for plain data dumps; they're for cross-comparison tables (margin matrices, KPI grids, scenario tables) where structure aids reading.

## Number Format Library

`scripts/style_kit.py` exposes a `NUMFMT` dict. Use `NUMFMT` keys for `column_formats` and `y_number_format`. Don't write format strings inline.

| Key | Format string | Use for |
|---|---|---|
| `int` | `#,##0;[Red](#,##0);"-"` | Integer counts (headcount, units) |
| `dec_1` | `#,##0.0;[Red](#,##0.0);"-"` | 1-dp decimals |
| `dec_2` | `#,##0.00;[Red](#,##0.00);"-"` | 2-dp decimals |
| `dollar` | `$#,##0;[Red]($#,##0);"-"` | Whole dollars |
| `dollar_2` | `$#,##0.00;[Red]($#,##0.00);"-"` | Dollars + cents |
| `pct_0` | `0%;[Red](0%);"-"` | Whole-percent rates |
| `pct_1` | `0.0%;[Red](0.0%);"-"` | 1-dp percentages (margins, growth) |
| `pct_2` | `0.00%;[Red](0.00%);"-"` | 2-dp percentages (interest rates) |
| `multiple` | `0.0"x"` | Valuation multiples (EV/EBITDA, P/E) |
| `date` | `yyyy-mm-dd` | ISO dates |
| `date_us` | `mm/dd/yyyy` | US-format dates |
| `date_q` | `"Q"q yyyy` | Quarter labels (Q1 2025) |
| `date_my` | `mmm yyyy` | Month-year (Jan 2025) |
| `year` | `0` | Year as text (avoids "2,024") |
| `text` | `@` | Force text rendering (preserve leading zeros, IDs) |
| `general` | `General` | Excel default (no formatting) |
| `simple_int` | `#,##0` | Integer without neg-paren / zero-dash |
| `simple_dec_2` | `#,##0.00` | Decimal without neg-paren / zero-dash |
| `simple_dollar` | `$#,##0` | Dollar without neg-paren / zero-dash |
| `simple_pct_1` | `0.0%` | Percent without neg-paren / zero-dash |

```python
from style_kit import NUMFMT
ws['B2'].number_format = NUMFMT['dollar']
ws['C2'].number_format = NUMFMT['pct_1']
```

`verify_workbook.py` flags `FMT001` (info only) when it sees number formats outside this library, to surface fragmentation.

## Quick examples

### Read / analyze with pandas
```python
import pandas as pd
df = pd.read_excel('file.xlsx')  # Default: first sheet
all_sheets = pd.read_excel('file.xlsx', sheet_name=None)  # dict of all
df.head(); df.info(); df.describe()
df.to_excel('output.xlsx', index=False)
```

### Create a workbook (use builders, not raw openpyxl)
```python
import pandas as pd
from openpyxl import Workbook
from openpyxl.styles import Font
from builders import build_table, build_chart   # in scripts/

wb = Workbook()
wb._named_styles['Normal'].font = Font(name='Microsoft YaHei', size=11)
ws = wb.active; ws.title = 'Data'
df = pd.read_csv('quarters.csv')

t = build_table(
    ws, data=df, anchor='A1', theme='modern_finance',
    column_formats={'Revenue ($mm)': 'dollar', 'Margin': 'pct_1'},
)
build_chart(
    ws, kind='combo_bar_line',
    data_range=f"Data!A1:{t['columns']['Margin']}{t['data_rows'][1]}",
    series_orient='cols',
    title='Revenue and margin ($mm)',
    anchor='G2', size=(720, 360),
    y_axis_min='zero',
)
wb.save('output.xlsx')
```

### Edit an existing workbook
```python
from openpyxl import load_workbook

# Editing preserves formulas/formatting (do NOT load with data_only=True if saving back)
wb = load_workbook('existing.xlsx')
ws = wb['SheetName']

# Working with multiple sheets
for sheet_name in wb.sheetnames:
    ws = wb[sheet_name]
    print(f"Sheet: {ws}")

# Modify cells
ws['A1'] = 'New Value'
ws.insert_rows(2); ws.delete_cols(3)

# Add new sheet
new_sheet = wb.create_sheet('NewSheet')
new_sheet['A1'] = 'Data'

wb.save('modified.xlsx')
```

**Notes:**
- openpyxl indices are **1-based** (row=1, col=1 → A1).
- `load_workbook(..., data_only=True)` reads cached values; **saving such a workbook permanently destroys formulas**.
- For huge files use `read_only=True` / `write_only=True`.
- For deliverable tables/charts on an existing workbook, call `build_table` / `build_chart` on the loaded `ws` exactly as in a fresh one.

## Financial models (special case)

When the deliverable is a financial model (DCF / LBO / 3-statement / scenario analysis / valuation memo), follow these conventions on top of the standard `build_table` / `build_chart` workflow. Skip when the user provides their own template.

- **Always state units in the header** — `'Revenue ($mm)'`, not `'Revenue'`. The chart picks up the column name verbatim for the legend.
- Add a comment or adjacent cell. Format: `Source: [System/Document], [Date], [Specific Reference], [URL if applicable]`. Examples:
  * `Source: Company 10-K, FY2024, Page 45, Revenue Note, [SEC EDGAR URL]`
  * `Source: Bloomberg Terminal, 8/15/2025, AAPL US Equity`

## Recalculating formulas — script details

openpyxl writes formulas as strings without cached values. Two scripts:

### Preferred — `scripts/recalc.py` (drives LibreOffice)
```bash
python scripts/recalc.py <excel_file> [timeout_seconds]
```
- Sets up the LibreOffice macro on first run; works on Linux and macOS.
- Recalculates every formula in every sheet and writes cached values back.
- Scans all cells for Excel errors (#REF!, #DIV/0!, etc.) and returns JSON with locations and counts.

### Fallback — `scripts/recalc_fallback.py` (no LibreOffice required)
Use when `recalc.py` reports `LibreOffice (soffice) is not installed`:
```bash
python scripts/recalc_fallback.py <excel_file>
```
- Sets `workbook.calcPr.fullCalcOnLoad=true` so Excel/WPS/Numbers/Sheets recompute on next open.
- Statically scans formulas via the `formulas` library; reports the same error summary as `recalc.py`.
- Cached values stay empty until a real spreadsheet app opens it. Best-effort scan (volatile/vendor-specific functions may be missed); the `fullCalcOnLoad` step always runs.
- **Never overwrite a formula with a hardcoded value** (`cell.value = computed_number` breaks the model).

Install once if missing: `pip install formulas openpyxl`.

### Interpreting recalc.py output
```json
{
  "status": "success",          // or "errors_found"
  "total_errors": 0,
  "total_formulas": 42,
  "error_summary": {            // present only if errors found
    "#REF!": { "count": 2, "locations": ["Sheet1!B5", "Sheet1!C10"] }
  }
}
```

### Quick sanity checks before scaling formulas
- Test 2–3 sample references first; confirm column letters (col 64 = BL, not BK) and that rows are 1-indexed (DataFrame row 5 = Excel row 6).
- Guard denominators (avoid `#DIV/0!`); verify cross-sheet refs use `Sheet1!A1`.

## Workbook Skeletons

For non-trivial tasks, pick a structural skeleton up front. Don't dump everything into one sheet.

| Skeleton | When to use | Sheets (in order) |
|---|---|---|
| **Data export** | Single-purpose dataset (e.g. CSV → xlsx + formatting) | `Data` |
| **Dashboard report** | Visual summary of underlying data | `README`, `Dashboard`, `Data` |
| **Analysis model** | Inputs → calculations → outputs | `README`, `Inputs`, `Calc`, `Output`, `Sources` |
| **Audit / reconciliation** | Compare two sources, surface variances | `README`, `Source_A`, `Source_B`, `Variance`, `Notes` |

Conventions across all skeletons:
- `README` (when present): purpose, last-updated date, color/format legend, owner.
- `Sources` / `Notes`: cite every hardcoded number.
- Hide intermediate scratch sheets (`ws.sheet_state = 'hidden'`) instead of deleting them.
- `Dashboard` lives at index 0 so it opens first: `wb.move_sheet(ws, offset=-len(wb.sheetnames))`.
- Always use `build_table` to render text-heavy sheets (e.g. `README`, `Sources`, cover/legend pages). Writing raw cells skips the theme font, banding, and column widths and looks broken next to the data sheets.

These are starting points, not straitjackets — collapse or split sheets as the task demands.

## Code Style
- Minimal, concise Python — no verbose names, no chatty prints, no unnecessary comments.
- For Excel files themselves: comment cells with complex formulas or important assumptions, document data sources, annotate key calculations.
