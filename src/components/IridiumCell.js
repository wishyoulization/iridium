import { html } from 'htm/preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import { describeState } from '../notebook.js';
import CodeEditor from './CodeEditor.js';
import IridiumIconButton from './IridiumIconButton.js';

// A class on the results that styles can key off: viewof, mutable or import.
const cellType = (source) =>
  String(source).trimStart().match(/^(viewof|mutable|import) /)?.[1] ?? '';

const IridiumCell = (props) => {
  const ref = useRef(null);
  const [error, setError] = useState(null);
  const [sourceCode, setSourceCode] = useState(props.sourceCode || '');
  const [savedSourceCode, setSavedSourceCode] = useState(null);
  const run = useRef(null); // { root, state } of the current definition
  const [editor, setEditor] = useState(null); // { setter } from CodeEditor
  const unsaved = savedSourceCode !== sourceCode;

  // Deletes the cell's variables and detaches their output, so a late update
  // from a deleted variable cannot draw over the next run.
  const clear = () => {
    if (!run.current) return;
    props.notebook.dispose(run.current.state);
    run.current.root.remove();
    run.current = null;
  };

  const onDelete = () => {
    runToken.current++; // drop any compile still in flight
    props.onDelete();
    clear();
  };

  const runToken = useRef(0);
  const compiling = useRef(false);
  const errorRef = useRef(null); // the compile error, for describe()
  errorRef.current = error;
  const onRun = async () => {
    const source = sourceCode;
    setSavedSourceCode(source);
    props.onUpdate(source);
    clear();

    // Compiling is instant when the cell's saved record is current; otherwise
    // it loads the compiler first. Ignore results a newer run has overtaken.
    const token = ++runToken.current;
    compiling.current = true;
    let record;
    try {
      record = await props.notebook.compile(source, props.compiled);
    } catch (e) {
      record = { error: String(e) }; // e.g. the compiler failed to load
    }
    if (token !== runToken.current) return;
    compiling.current = false;
    if (record.v && record !== props.compiled) props.onCompiled(record);
    if (record.error) {
      setError(record.error);
      console.warn(record.error);
      return;
    }

    const root = ref.current.appendChild(document.createElement('div'));
    try {
      run.current = { root, state: props.notebook.define(record, root) };
      setError(null);
      props.notebook.flush();
    } catch (e) {
      root.remove();
      setError(e);
      console.warn(e);
    }
  };

  // The cell's state as data, for the notebook controller (see describeState).
  const describe = () => {
    const source = sourceCode;
    const report = { id: props.id, rev: props.rev ?? 0, pinned: !!props.pinned, source };
    if (errorRef.current) return { ...report, status: 'error', error: String(errorRef.current) };
    if (compiling.current) return { ...report, status: 'pending' };
    if (!run.current) return { ...report, status: source.trim() ? 'pending' : 'empty' };
    return { ...report, ...describeState(run.current.state) };
  };
  const describeRef = useRef(describe);
  describeRef.current = describe;

  useEffect(() => {
    const reporter = () => describeRef.current();
    props.register?.(props.id, reporter);
    return () => {
      // Unmounted (deleted, or replaced by a remote edit): drop the variables.
      runToken.current++;
      clear();
      props.unregister?.(props.id, reporter);
    };
  }, []);

  // js-beautify is only needed for the Indent button; load it on first use.
  const formatCode = async () => {
    const { default: beautify } = await import('js-beautify/js/src/javascript');
    editor?.setter(beautify(sourceCode, {}));
  };

  const onKeyDown = (event) => {
    if (event.key === 'Enter' && event.shiftKey) {
      event.preventDefault();
      onRun();
    } else if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
      // Run, then let the event reach the notebook, which saves.
      event.preventDefault();
      onRun();
    }
  };

  useEffect(() => {
    if (sourceCode) onRun();
  }, []);

  return html`<div
    class=${`IridiumCell ${props.pinned ? 'Pinned' : 'UnPinned'} ${
      unsaved ? 'IridiumCellUnsaved' : 'IridiumCellSaved'
    }`}
  >
    <div style=${`display: ${error ? 'block' : 'none'}`} class="CellError">
      <div class="observablehq observablehq--error">
        <div class="observablehq--inspect">${String(error)}</div>
      </div>
    </div>
    <div
      ref=${ref}
      class=${`CellResults ${cellType(sourceCode)}`}
      style=${`display: ${error ? 'none' : 'block'}`}
    ></div>
    <div class="CellBefore">
      <${IridiumIconButton} name="plus-square" onClick=${props.addBefore} />
    </div>
    <div class="CellActions" onClick=${props.onPinToggle}>
      <${IridiumIconButton}
        content="Pin"
        name=${props.pinned ? 'pin-angle-fill' : 'pin-angle'}
      />
    </div>
    ${props.pinned
      ? html`<div class="CellContainer">
          <${CodeEditor}
            code=${sourceCode}
            index=${props.index}
            onUpdate=${setSourceCode}
            onKeyDown=${onKeyDown}
            onReady=${setEditor}
          />
          <div class="CellEditorActions">
            <${IridiumIconButton}
              content="Delete"
              name="trash2"
              onClick=${onDelete}
            />
            <${IridiumIconButton}
              content="Indent"
              name="text-indent-left"
              style="font-size: 1.25rem;"
              onClick=${formatCode}
            />
            <${IridiumIconButton}
              content="Run"
              name=${unsaved ? 'play-fill' : 'play'}
              style="font-size: 1.25rem;"
              onClick=${onRun}
            />
          </div>
        </div>`
      : null}
  </div>`;
};

export default IridiumCell;
