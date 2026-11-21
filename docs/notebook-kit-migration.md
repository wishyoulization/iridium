# Replacing the compiler with Observable Notebook Kit

Goal of the `feat/notebook-kit-backend` branch: keep Iridium's UI and behaviour exactly as it is, but run cells on Observable's own engine ([Notebook Kit](https://observablehq.com/notebook-kit/kit), the open-source core that [Observable Desktop](https://observablehq.com/notebook-kit/desktop) is built on) instead of `@alex.garcia/unofficial-observablehq-compiler` (last release 0.6.0-alpha.9, 2022, pinned to `@observablehq/parser` 4.2).

Status: implemented (`src/notebook.js`, `IridiumCell.js`, `IridiumNotebook.js`, `rollup.config.mjs`). The research notes below are kept for context; "As built" at the end lists where the implementation differs from the plan.

## What Iridium uses today

The compiler surface is small:

| Where | What | Notes |
| --- | --- | --- |
| `IridiumNotebook.js` | `new Interpreter({ module: main, resolveImportPath })` | one per notebook |
| `IridiumCell.js` | `interpreter.cell(source, null, observer)` → `Variable[]` | compile + define in one call |
| `IridiumCell.js` | `v.delete()` + remove `v._observer._node` | on re-run and on delete |
| `IridiumNotebook.js` | `iridiumImportResolver` | `@user/nb` → api.observablehq.com, gists → blob URL |
| `IridiumNotebook.js` | `main.define('width', …)` | width tracks the notebook element |
| `IridiumCell.js` | `get_cell_type` regex | only for UI hints (`viewof`/`mutable`/`import`) |

## Notebook Kit equivalents

`@observablehq/notebook-kit@2.11.0` exposes exactly the two halves we need, and shares `@observablehq/runtime@6.1.0` / `@observablehq/inspector@5` with the versions already on `main`-line after the dependency upgrade.

| Today | Notebook Kit |
| --- | --- |
| `interpreter.cell(src)` (compile) | `transpile({ id, value: src, mode: 'ojs' })` from `@observablehq/notebook-kit` → `{ body, inputs, outputs, output, autodisplay, autoview, automutable, imports }` |
| `interpreter.cell(src)` (define) | `(0, eval)('(' + body + ')')` then `notebook.define(state, { id, ...transpiled, body })` from `@observablehq/notebook-kit/runtime` |
| `new Runtime(new Library())` | `new NotebookRuntime(builtins)` (Kit's own stdlib) |
| `Inspector` per variable | Kit's `observe(state, …)` renders into `state.root`; `state.variables` collects the cell's variables |
| `iridiumImportResolver` | built in: `observable:` imports → `https://api.observablehq.com/…js?v=4`; bare `import("pkg")` → esm.sh. Custom `resolveImport` option still available for gists |

`mode: 'ojs'` is the key: it compiles classic Observable JavaScript with the official parser v6, so existing Iridium notebooks run unchanged — `viewof`, `mutable`, generators, `import {x} with {y} from "@user/nb"`, and `viewof x` names stay compatible with notebooks published on observablehq.com.

## Prototype results (browser, bundled with Rollup 4)

All of these ran through `transpile` → `eval` → `define`:

| Cell | Result |
| --- | --- |
| `a = 10`, `b = a * 2` | ✅ `b = 20`; redefining `a = 100` → `b = 200` |
| `viewof n = Inputs.range(…)`, `n * 3` | ✅ slider renders, `15` |
| `mutable m = 1`, `{ mutable m = mutable m + 1 }`, `m` | ✅ `2` |
| generator `tick = { … yield i++ … }` | ✅ ticks |
| ``md`# Hello ${b}` ``, ``html`<b>…</b>` `` | ✅ (md via bundled markdown-it, html via htl) |
| `width`, `now`, `DOM.uid` | ✅ |
| `d3.range(3)`, `Plot.plot(…)` | ✅ lazy from esm.sh |
| `d3r = require("d3-array@3")` | ✅ **only with a shim** (see below) |
| `d3a = import("d3-array")` | ✅ rewritten to esm.sh |
| `import {Legend} from "@d3/color-legend"` | ✅ `typeof Legend === "function"` |
| `x = (` | ✅ compile error with position, `SyntaxError: Unexpected end of input (1:5)` |
| `undefinedThing + 1` | ✅ `RuntimeError: undefinedThing is not defined` |
| delete `a` | ✅ `b = RuntimeError: a is not defined` |

## Gaps and decisions

1. **`require()` is gone from Kit's stdlib.** Classic notebooks use it a lot. Shim it from `@observablehq/stdlib` (already a dependency):
   `new NotebookRuntime({ ...library, require: () => new Library().require() })`. Verified working.
2. **Re-running a cell needs a fresh container.** Kit never redefines cells at runtime (its dev server reloads the page). Deleting old variables makes their observer write a final `undefined` into the shared root, clobbering the new output. Fix, verified: render each run into its own child `<div>` and remove the previous one — the same thing `IridiumCell` already does with `_observer._node`.
3. **Compile before deleting.** With Kit, `transpile` throws on syntax errors before anything is defined, so we can keep the last good variables alive until the new source compiles (today's behaviour deletes first). Small UX improvement, optional.
4. **Bundle format must become ESM.** Kit's lazy stdlib modules (`L`, `mermaid`, `tex`, `DuckDBClient`, `vl`, `SQLite`, `xlsx`, `zip`, …) import from `https://esm.sh/…` statically. Inlining them into one IIFE would make those imports eager and require network at startup. Output must be `format: 'es'` with code-split chunks and `https://` imports left external; `index.html` loads it with `<script type="module">`. With that, startup makes no network requests — libraries load on first use, as `require` did before.
   - Consequence: `dist/` becomes `iridium.js` + `chunks/`. Embedders that load `dist/iridium.js` as a classic `<script>` must switch to `type="module"`. `window.Iridium` stays.
   - The minified-globals leak fixed by the IIFE switch does not come back: module scripts have their own scope.
5. **Bundle size.** Prototype entry (Kit compiler + runtime + stdlib + inspector, no UI) is 316 KB raw / 88 KB gzip; Iridium's UI (preact, codejar, highlight.js, js-beautify) adds roughly 100 KB raw. Expect ~420 KB raw / ~115 KB gzip for the entry, slightly over the README's "< 400 KB" claim. Lazy chunks (markdown-it 138 KB, etc.) load only when used.
6. **`width` and theme.** Kit's `width` builtin observes `document.querySelector("main") ?? document.body`; keep Iridium's own `width` definition (notebook element minus 28px) by redefining it on `main` as today. Kit ships Observable's CSS themes (`@observablehq/notebook-kit/*.css`); not needed to keep the current look — keep `inspector.scss`.
7. **Unused Kit side effect.** Importing `@observablehq/notebook-kit/runtime` also constructs a default `NotebookRuntime` at module load. Harmless (no cells), small cost.
8. **Dev dependency weight.** The package depends on `vite`, `jsdom` and others for its CLI. They land in `node_modules` but are not bundled (the `.`, `/runtime` entry points are browser-safe; only `/vite`, `/databases`, `interpreters` pull Node code).

## Bonus: Desktop-compatible files

Kit's `serialize`/`deserialize` read and write the Notebooks 2.0 HTML file format that Observable Desktop edits. Iridium cells map cleanly (`{ id, pin, sourceCode }` → `{ id, pinned, value, mode: 'ojs' }`, stored as `<script type="application/vnd.observable.javascript">`), so Iridium could export/import `.html` notebooks that open in Desktop. Out of scope for the backend swap; a natural follow-up.

## Implementation plan

1. `IridiumNotebook.js`: replace `Runtime`/`Library`/`Interpreter` with one `NotebookRuntime` (with the `require` shim) and keep the `width` override; pass `notebook` instead of `interpreter` to cells; drop `iridiumImportResolver` (keep the gist case via `transpile`'s `resolveImport` if still wanted).
2. `IridiumCell.js`: `_onSave` → `transpile` (catch → show error), `eval` body, delete previous variables + remove previous child div, `define` into a fresh child div; `_onDelete` unchanged in spirit.
3. `rollup.config.mjs`: `format: 'es'`, `dir: 'dist'`, chunk names, `external: /^https?:\/\//`, add a `.css` loader for Kit's `inputs.css`.
4. `dist/index.html`: `<script type="module" src="./iridium.js">` (inline script also `type="module"` or wait for load).
5. Remove `@alex.garcia/unofficial-observablehq-compiler`; keep `@observablehq/stdlib` for `require`, keep `@observablehq/inspector` only if still used directly.
6. Test the same matrix as above in the real UI, plus save/reload.

## As built

- `src/notebook.js` owns the backend: `createNotebook()` returns `{ main, run(source, root), dispose(state) }`. Components never touch Kit directly.
- **`require`** comes from `d3-require` (the same implementation `@observablehq/stdlib` used), not from `@observablehq/stdlib` itself, which would add ~40 KB to the entry for one function.
- **Observer:** Kit's default observer appends DOM values bare and has no running state. Iridium passes its own observer that renders every value through `@observablehq/inspector` into a `div.observablehq`, matching the old output markup (and the CSS that relies on it). The old `viewof`/`mutable` `nth-child` CSS rules are removed: each cell now has a single output.
- **Import cells** display the same highlighted `import {x as x} from "…"` line the old compiler rendered.
- **Gist imports** (`gist.githubusercontent.com`) keep working: the compiled `import(…)` is routed through a fetch → blob URL loader, as before.
- **TypeScript parser stubbed out:** Kit always builds an acorn-typescript parser (~190 KB) that `ojs` cells never use. The build replaces it with a stub that throws for TypeScript cells. Entry: 365 KB raw / 109 KB gzip (was 342 KB / 104 KB).
- **Re-run:** the cell deletes its old variables and removes its old output container before compiling (same order as before), so a compile error still shows on the cell and dependents report `x is not defined`.

### Verified in the browser, side by side with the previous build

Same output markup and text for: values, dependents, `viewof` (html input and `Inputs.range`), `mutable`, generators, `md`, `html`, `width`, `require`, `d3`, notebook imports, object/function/string inspection, compile errors, runtime errors. Edit + Shift+Enter, compile error then fix, delete, add cell, save (button and Cmd+S), reload.

Differences from the previous build:

- Improvements: `{ mutable m = … }` in another cell and `import … with {…} from "…"` now work (both failed before).
- `md` output is wrapped in one extra `<div>` (same size and styling), and `h1` headings no longer get an `id` anchor (Kit anchors `h2`/`h3`).
- Notebook imports use api.observablehq.com `?v=4` modules (was `?v=3`).
- `dist/` is now `iridium.js` + `chunks/`, loaded with `<script type="module">`.

## Plain JavaScript cells (auto-detected)

`compile()` in `src/notebook.js` picks the cell mode with no UI change:

1. Source with `from "npm:…"` / `from "jsr:…"` → plain JavaScript (`js`) if it compiles. These imports parse as Observable JavaScript too, but there they would be treated as notebook imports and fail.
2. Otherwise Observable JavaScript (`ojs`) first, so every existing notebook behaves exactly as before.
3. If that fails, plain JavaScript; if that fails too, the Observable JavaScript error is shown.

Plain JavaScript cells: several statements, top-level `const`/`let`/`function`/`class` declarations exported to other cells, default/namespace/`npm:` imports, `display(…)` (several calls append outputs; a re-run replaces them). A cell that only declares values shows no output, as in Notebooks 2.0. `https://` named imports such as gists stay Observable notebook imports, as before.

Also: Kit's `md` turns `h2`/`h3` into permalinks; `editor.scss` keeps them looking like plain headings.
