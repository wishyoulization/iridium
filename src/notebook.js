// Iridium's notebook backend: Observable Notebook Kit compiles and runs cells.
import { transpile } from '@observablehq/notebook-kit';
import { NotebookRuntime, library } from '@observablehq/notebook-kit/runtime';
import { Inspector } from '@observablehq/inspector';
import { require as classicRequire } from 'd3-require';
import { parseCell } from '@observablehq/parser';
import hljs from 'highlight.js/lib/core';
import javascript from 'highlight.js/lib/languages/javascript';
hljs.registerLanguage('javascript', javascript);

// Import cells display nothing in Notebook Kit. Iridium has always shown the
// resolved import as a highlighted line, e.g.
//   import {Legend as Legend} from "@d3/color-legend"
// so render the same text and markup the previous compiler produced.
const importSummary = (source) => {
  if (!/^\s*import\b/.test(source)) return null;
  let body;
  try {
    body = parseCell(source).body;
  } catch {
    return null;
  }
  if (body?.type !== 'ImportDeclaration') return null;
  const names = (specifiers = []) =>
    specifiers.flatMap(({ imported, local, view, mutable }) => [
      ...(view ? [`viewof ${imported.name} as viewof ${local.name}`] : []),
      ...(mutable ? [`mutable ${imported.name} as mutable ${local.name}`] : []),
      `${imported.name} as ${local.name}`,
    ]);
  const injections = body.injections
    ? `with {${names(body.injections).join(', ')}} `
    : '';
  const text = `import {${names(body.specifiers).join(', ')}} ${injections}from "${body.source.value}"`;
  const node = document.createElement('div');
  node.className = 'observablehq';
  node.innerHTML = `<pre class="observablehq--md-pre"><code class="javascript hljs">  ${
    hljs.highlight(text, { language: 'javascript' }).value
  }\n</code></pre>`;
  return node;
};

// Gists are served as text/plain, which browsers refuse to import() directly,
// so fetch the source and import it from a blob URL instead.
const GIST_IMPORT = /\bimport\(("https:\/\/gist\.githubusercontent\.com\/[^"]*")\)/g;
const importGist = (url) =>
  fetch(url)
    .then((res) => res.text())
    .then((js) =>
      import(URL.createObjectURL(new Blob([js], { type: 'text/javascript' }))),
    );

// Kit's default observer appends DOM values bare and has no running state.
// Iridium has always rendered every value through an Inspector node
// (div.observablehq), which its CSS uses for spacing and the running/error
// bar, so observe cells the same way the previous compiler did.
const observe = (state, { autodisplay, output }) => {
  const name = output?.replace(/^initial /, '').replace(/^viewof\$/, 'viewof ');
  let inspector = null;
  const inspect = () =>
    (inspector ??= new Inspector(
      state.root.appendChild(document.createElement('div')),
    ));
  if (autodisplay) inspect();
  return {
    _node: state.root, // used by the runtime's visibility()
    pending: () => inspector?.pending(),
    fulfilled: (value) => {
      if (autodisplay) inspect().fulfilled(value, name);
    },
    rejected: (error) => inspect().rejected(error, name),
  };
};

// Every definition needs an id that is unique within the runtime; Kit uses it
// to name a cell's internal variables. Re-runs get a new id too.
let nextDefinitionId = 0;

export function createNotebook() {
  // Kit's stdlib dropped the classic AMD require(); keep it for old notebooks.
  // It is the same d3-require that @observablehq/stdlib used to provide.
  const notebook = new NotebookRuntime({
    ...library,
    require: () => classicRequire,
  });

  // Compiles Observable JavaScript and defines it, rendering into root.
  // Throws (e.g. SyntaxError) without defining anything if it does not compile.
  const run = (source, root) => {
    const id = ++nextDefinitionId;
    const transpiled = transpile({ id, value: source, mode: 'ojs' });
    const body = new Function(
      '__importGist',
      `return (${transpiled.body.replace(GIST_IMPORT, '__importGist($1)')});`,
    )(importGist);
    // Kit clears state.root whenever the cell settles, so give it its own
    // container and keep Iridium's extra import line next to it.
    const summary = importSummary(source);
    if (summary) root.appendChild(summary);
    const state = {
      root: root.appendChild(document.createElement('div')),
      expanded: [],
      variables: [],
    };
    notebook.define(state, { ...transpiled, id, body }, observe);
    return state;
  };

  // Removes a cell's variables. Their observers may still fire once with
  // undefined, so callers should detach the root they passed to run() rather
  // than reuse it.
  const dispose = (state) => {
    if (!state) return;
    for (const v of state.variables) v.delete();
    state.variables.length = 0;
  };

  return { main: notebook.main, run, dispose };
}
