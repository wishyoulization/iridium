# Iridium

A minimal notebook environment with many features omitted intentionally.

The bundle size is &lt; 400kb and around 110kb gzpd, meant for embedding in hard to reach development environments to interactively debug and develop plugins, extensions or use standalone offline with sensitive data.

Cells are compiled and run by Observable's own engine, [Notebook Kit](https://observablehq.com/notebook-kit/kit). A cell is classic Observable JavaScript (`x = …`, `viewof`, `mutable`, `import {x} from "@user/notebook"`, `require(…)`) when it parses as one; otherwise it runs as plain JavaScript, as in Observable Notebooks 2.0: several statements, `const` declarations (visible to other cells), default/namespace imports, `import {x} from "npm:…"`, and `display(…)` for output.

## Embedding

`dist/` is an ES module build: copy `iridium.js` together with the `chunks/` folder, and load it as a module. It sets `window.Iridium`.

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

## Development

```bash
npm install
npm start      # rebuild dist/ on change
npm run build  # one-off build
```

https://wishyoulization.github.io/iridium/ 
