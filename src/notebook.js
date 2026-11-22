// Iridium's notebook backend: Observable Notebook Kit's runtime runs cells.
// Compiling is separate (src/compile.js, loaded on demand) so notebooks whose
// cells carry a current compiled record never download the compiler.
import { NotebookRuntime, library } from '@observablehq/notebook-kit/runtime';
import { Inspector } from '@observablehq/inspector';
import { require as classicRequire } from 'd3-require';
import { html, svg } from './classic-template.js';
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
  // Tracked for describeCell(): the latest status, value and error.
  Object.assign(state, { name, status: 'pending', value: undefined, error: undefined });
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
    pending: () => {
      state.status = 'pending';
      inspector?.pending();
    },
    fulfilled: (value) => {
      Object.assign(state, { status: 'fulfilled', value, error: undefined });
      if (autodisplay) inspect().fulfilled(value, name);
    },
    rejected: (error) => {
      Object.assign(state, { status: 'rejected', value: undefined, error });
      inspect().rejected(error, name);
    },
  };
};

// A short, readable description of any value, for reporting outputs as text
// (e.g. to an assistant editing the notebook): at most ~`limit` characters.
export const describeValue = (value, limit = 600) => {
  const seen = new Set();
  const describe = (v, depth) => {
    if (v === null || v === undefined || typeof v === 'boolean' || typeof v === 'number') return String(v);
    if (typeof v === 'bigint') return `${v}n`;
    if (typeof v === 'string') return JSON.stringify(v.length > 200 ? `${v.slice(0, 200)}…` : v);
    if (typeof v === 'symbol') return v.toString();
    if (typeof v === 'function') {
      const head = Function.prototype.toString.call(v).split('{')[0].split('=>')[0].trim();
      return `ƒ ${v.name || ''}${head.match(/\(.*\)/s)?.[0] ?? '()'}`.replace(/\s+/g, ' ');
    }
    if (v instanceof Element) {
      const attributes = ['id', 'class', 'width', 'height', 'type', 'value', 'href', 'src']
        .filter((a) => v.hasAttribute?.(a))
        .map((a) => ` ${a}="${String(v.getAttribute(a)).slice(0, 40)}"`)
        .join('');
      const text = (v.textContent ?? '').replace(/\s+/g, ' ').trim();
      const children = v.querySelectorAll('*').length;
      return `<${v.tagName.toLowerCase()}${attributes}> element${children ? ` with ${children} descendants` : ''}${text ? `, text: ${JSON.stringify(text.slice(0, 160))}` : ''}`;
    }
    if (v instanceof Node) return `${v.constructor.name} node`;
    if (v instanceof Date) return `Date ${isNaN(v) ? 'Invalid' : v.toISOString()}`;
    if (v instanceof RegExp) return String(v);
    if (v instanceof Error) return `${v.name}: ${v.message}`;
    if (v instanceof Promise) return 'Promise';
    if (seen.has(v)) return '[circular]';
    if (depth > 2) return Array.isArray(v) ? `Array(${v.length})` : `${v.constructor?.name ?? 'Object'} {…}`;
    seen.add(v);
    if (Array.isArray(v) || ArrayBuffer.isView(v)) {
      const items = Array.from(v.slice(0, 10), (x) => describe(x, depth + 1));
      return `${v.constructor.name}(${v.length}) [${items.join(', ')}${v.length > 10 ? ', …' : ''}]`;
    }
    if (v instanceof Map) {
      const entries = [...v].slice(0, 8).map(([k, x]) => `${describe(k, depth + 1)} => ${describe(x, depth + 1)}`);
      return `Map(${v.size}) {${entries.join(', ')}${v.size > 8 ? ', …' : ''}}`;
    }
    if (v instanceof Set) {
      const items = [...v].slice(0, 10).map((x) => describe(x, depth + 1));
      return `Set(${v.size}) {${items.join(', ')}${v.size > 10 ? ', …' : ''}}`;
    }
    const keys = Object.keys(v);
    const entries = keys.slice(0, 10).map((k) => `${k}: ${describe(v[k], depth + 1)}`);
    const type = v.constructor && v.constructor !== Object ? `${v.constructor.name} ` : '';
    return `${type}{${entries.join(', ')}${keys.length > 10 ? `, … (${keys.length} keys)` : ''}}`;
  };
  const text = describe(value, 0);
  return text.length > limit ? `${text.slice(0, limit)}…` : text;
};

const describeError = (error) =>
  error instanceof Error ? `${error.name}: ${error.message}` : String(error?.message ?? error);

// Internal variable names Kit creates alongside a cell's own outputs.
const isInternalName = (name) => !name || /^(cell \d+|initial |mutable\$|viewof\$)/.test(name);

// Describes a defined cell's current state (see define()).
export const describeState = (state) => {
  const report = { status: state.status };
  if (state.name) report.name = state.name;
  if (state.status === 'fulfilled' && state.value !== undefined) report.value = describeValue(state.value);
  // A view's current input value (`viewof x`'s x), read from the element.
  if (state.name?.startsWith('viewof ') && state.value && 'value' in state.value) {
    report.input = describeValue(state.value.value, 200);
  }
  if (state.status === 'rejected') report.error = describeError(state.error);
  // Plain JavaScript cells export their top-level declarations. The runtime
  // only computes values that something uses.
  const exports = {};
  for (const variable of state.variables) {
    if (isInternalName(variable._name) || variable._name === state.name) continue;
    exports[variable._name] =
      variable._error !== undefined ? `Error: ${describeError(variable._error)}`
      : !variable._reachable && variable._value === undefined ? '(not computed: no cell uses it yet)'
      : describeValue(variable._value, 200);
  }
  if (Object.keys(exports).length) report.exports = exports;
  const text = state.root.innerText?.replace(/\s+/g, ' ').trim();
  if (text) report.text = text.length > 400 ? `${text.slice(0, 400)}…` : text;
  return report;
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
    // Classic Observable html/svg (strings become markup), which classic
    // notebooks and helpers like @jashkenas/inputs depend on. Kit's Hypertext
    // Literal versions remain available as htl.html and htl.svg.
    html: () => html,
    svg: () => svg,
  });

  // Resolves to the compiled record for source: the given record if it is
  // still current, otherwise a fresh one from the compiler (loaded on demand).
  const compile = async (source, record) =>
    isCurrent(record, source) ? record : (await loadCompiler()).compileCell(source);

  // Defines a compiled record (without an error), rendering into root.
  const define = (record, root) => {
    const id = ++nextDefinitionId;
    // Strict mode, as in Observable's compiled modules: a cell's `this` is its
    // previous value, undefined on the first run (sloppy mode makes it window).
    const body = new Function(
      '__importGist',
      `"use strict"; return (${record.body.replace(GIST_IMPORT, '__importGist($1)')});`,
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
    // display()/view() are Notebooks 2.0 built-ins for plain JavaScript cells;
    // in Observable JavaScript they are ordinary names (e.g. an imported view).
    notebook.define(state, { ...record, id, body, display: record.mode === 'js' }, observe);
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

  // The runtime computes on animation frames, which background tabs don't
  // get; when the page is hidden (e.g. an assistant edits while you look
  // elsewhere), compute right away instead.
  const flush = () => {
    const runtime = notebook.runtime;
    if (typeof document !== 'undefined' && document.hidden && runtime._dirty.size) {
      runtime._computing = null;
      runtime._computeNow();
    }
  };

  // Evaluates source (an expression or cell) in the notebook without adding a
  // cell, and describes the result once it settles (or after `timeout` ms).
  const evaluate = async (source, { timeout = 10000 } = {}) => {
    const record = await compile(source);
    if (record.error) return { status: 'error', error: record.error };
    const root = document.createElement('div');
    const state = define(
      { ...record, output: undefined, outputs: [], autodisplay: true, autoview: false, automutable: false },
      root,
    );
    try {
      for (const end = Date.now() + timeout; state.status === 'pending' && Date.now() < end; ) {
        flush();
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
      return describeState(state);
    } finally {
      dispose(state);
    }
  };

  return { main: notebook.main, compile, define, dispose, evaluate, flush };
}
