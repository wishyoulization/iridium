// Iridium's notebook backend: Observable Notebook Kit's runtime runs cells.
// Compiling is separate (src/compile.js, loaded on demand) so notebooks whose
// cells carry a current compiled record never download the compiler.
import { NotebookRuntime, library } from '@observablehq/notebook-kit/runtime';
import { Inspector } from '@observablehq/inspector';
import { require as classicRequire } from 'd3-require';
import { isCurrent } from './compiled.js';

let compiler = null;
const loadCompiler = () => (compiler ??= import('./compile.js'));

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
  let node = null;
  // Cells that call display() let Kit clear state.root, which may detach our
  // node; start a fresh one so later values and errors stay visible.
  const inspect = () => {
    if (!inspector || node.parentNode !== state.root) {
      node = state.root.appendChild(document.createElement('div'));
      inspector = new Inspector(node);
    }
    return inspector;
  };
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
    // Kit's _ is esm.sh/lodash's default export, which esm.sh currently
    // serves as an empty object (_.chunk etc. are undefined). lodash-es works.
    _: () => import('https://esm.sh/lodash-es').then((module) => module.default),
  });

  // Resolves to the compiled record for source: the given record if it is
  // still current, otherwise a fresh one from the compiler (loaded on demand).
  const compile = async (source, record) =>
    isCurrent(record, source) ? record : (await loadCompiler()).compileCell(source);

  // Defines a compiled record (without an error), rendering into root.
  const define = (record, root) => {
    const id = ++nextDefinitionId;
    const body = new Function(
      '__importGist',
      `return (${record.body.replace(GIST_IMPORT, '__importGist($1)')});`,
    )(importGist);
    if (record.summary) {
      const summary = root.appendChild(document.createElement('div'));
      summary.className = 'observablehq';
      summary.innerHTML = `<pre class="observablehq--md-pre"><code class="javascript hljs">  ${record.summary}\n</code></pre>`;
    }
    // Kit clears state.root whenever the cell settles, so give it its own
    // container, next to Iridium's import line.
    const state = {
      root: root.appendChild(document.createElement('div')),
      expanded: [],
      variables: [],
    };
    notebook.define(state, { ...record, id, body }, observe);
    return state;
  };

  // Removes a cell's variables. Their observers may still fire once with
  // undefined, so callers should detach the root they passed to define()
  // rather than reuse it.
  const dispose = (state) => {
    if (!state) return;
    for (const v of state.variables) v.delete();
    state.variables.length = 0;
  };

  return { main: notebook.main, compile, define, dispose };
}
