// The compiler: turns a cell's source into a compiled record (see compiled.js).
// Loaded on demand, the first time a cell needs compiling, so notebooks whose
// cells are already compiled (e.g. view-only embeds) never download it.
import { transpile } from '@observablehq/notebook-kit';
import { parseCell } from '@observablehq/parser';
import hljs from './highlighter.js';
import { FORMAT, hashSource } from './compiled.js';

// Cells are classic Observable JavaScript (`x = …`, `viewof`, `mutable`,
// `import {x} from "@user/notebook"`) unless they only make sense as plain
// JavaScript: several statements, `const`/`let` declarations, default or
// namespace imports, `display(…)`. Try Observable JavaScript first so existing
// notebooks behave exactly as before, and fall back to plain JavaScript.
// `import {x} from "npm:…"` parses as both, but only works as plain JavaScript
// (as Observable JavaScript it would be treated as a notebook import).
const PACKAGE_IMPORT = /\bfrom\s*(["'])(npm|jsr):/;
const transpileCell = (source) => {
  // The id only names Kit's internal variables at define time, not the body.
  const as = (mode) => transpile({ id: 1, value: source, mode });
  if (PACKAGE_IMPORT.test(source)) {
    try {
      return as('js');
    } catch {
      // not valid plain JavaScript either; report the Observable error below
    }
  }
  try {
    return as('ojs');
  } catch (error) {
    try {
      return as('js');
    } catch {
      throw error; // the Observable JavaScript error is the familiar one
    }
  }
};

// Import cells display nothing in Notebook Kit. Iridium has always shown the
// resolved import as a highlighted line, e.g.
//   import {Legend as Legend} from "@d3/color-legend"
// matching the text the previous compiler produced.
const importSummary = (source) => {
  if (!/^\s*import\b/.test(source)) return undefined;
  let body;
  try {
    body = parseCell(source).body;
  } catch {
    return undefined;
  }
  if (body?.type !== 'ImportDeclaration') return undefined;
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
  return hljs.highlight(text, { language: 'javascript' }).value;
};

export function compileCell(source) {
  const record = { v: FORMAT, hash: hashSource(source) };
  try {
    const { body, inputs, outputs, output, autodisplay, autoview, automutable } =
      transpileCell(source);
    Object.assign(record, { body, inputs, outputs, output, autodisplay, autoview, automutable });
    record.summary = importSummary(source);
  } catch (error) {
    record.error = String(error);
  }
  return record;
}
