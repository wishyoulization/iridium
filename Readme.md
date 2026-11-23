# Iridium

A minimal notebook environment with many features omitted intentionally.

> Published on npm as `@a10k/iridium` (previously `@wishyoulization/iridium`).

The startup bundle is about 95kb (31kb gzipped), meant for embedding in hard to reach development environments to interactively debug and develop plugins, extensions or use standalone offline with sensitive data. Everything else loads on first use: the compiler (only when a cell needs compiling), syntax highlighting (when an editor is visible), the formatter (Indent button) and optional libraries.

Cells are compiled and run by Observable's own engine, [Notebook Kit](https://observablehq.com/notebook-kit/kit). A cell is classic Observable JavaScript (`x = …`, `viewof`, `mutable`, `import {x} from "@user/notebook"`, `require(…)`) when it parses as one; otherwise it runs as plain JavaScript, as in Observable Notebooks 2.0: several statements, `const` declarations (visible to other cells), default/namespace imports, `import {x} from "npm:…"`, and `display(…)` for output.

## Getting started

The easiest way to use Iridium is the [Iridium Dev Server](https://github.com/wishyoulization/iridium-dev-server): it saves notebooks as files, compiles them to embeddable ES modules, and includes an MCP server and skill so AI assistants such as Claude can build notebooks with you, live, in your browser tab.

```bash
npx @a10k/iridium-dev-server
```

To embed the editor yourself, install the package:

```bash
npm i @a10k/iridium
```

or load it from a CDN (`https://cdn.jsdelivr.net/npm/@a10k/iridium@0.0.2/dist/iridium.js`).

## Embedding

`dist/` is an ES module build: copy `iridium.js` together with the `chunks/` folder (or use the npm package or CDN copy above), and load it as a module. It sets `window.Iridium`.

```html
<script type="module" src="./iridium.js"></script>
<script type="module">
  Iridium.render(
    Iridium.html`<${Iridium.IridiumApp} Ir=${Iridium} />`,
    document.getElementById('iridium-root'),
  );
</script>
```

Startup needs no network. Optional libraries (`d3`, `Plot`, `Inputs`, `require(…)`, notebook imports, …) load from a CDN the first time a cell uses them.

`FileAttachment("x")` resolves against the page's base URL. To keep a notebook's files elsewhere, set `Iridium.files_base` (e.g. `Iridium.files_base = "/files/my-notebook/"`) before the notebook loads; other relative URLs still resolve against the page.

### Fast, view-only embeds

Saved cells keep a compiled record (`compiled`) next to their `sourceCode`. When every cell's record matches its source, the notebook runs without downloading the compiler; with editors hidden (add the `IridiumViewOnly` class to `<body>`), syntax highlighting is never loaded either. Save a notebook once from the editor to store the records; notebooks without them (or with edited sources) are compiled on load as before. Custom `Iridium.save`/`Iridium.load` implementations should keep the `compiled` field.

## Development

```bash
npm install
npm start      # rebuild dist/ on change
npm run build  # one-off build
```

https://wishyoulization.github.io/iridium/ 
