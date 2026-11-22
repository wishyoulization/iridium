import { html } from 'htm/preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import { createNotebook } from '../notebook.js';

import IridiumIconButton from './IridiumIconButton.js';
import IridiumCell from './IridiumCell.js';

const emptyCell = (id) => ({ id, pin: true, sourceCode: '' });

// What collaborators see of the cells: order, ids, pins and sources.
const plainCells = (cells) =>
  cells.map(({ id, pin, sourceCode }) => ({ id, pin: !!pin, sourceCode: sourceCode ?? '' }));
const snapshot = (cells) => JSON.stringify(plainCells(cells));

const IridiumNotebook = (props) => {
  const ref = useRef(null);
  const [notebook] = useState(createNotebook);
  const { main } = notebook;
  const [cells, setCellsState] = useState(props.cells);
  // The latest cells, updated synchronously: a cell can update its source and
  // save in the same event (Cmd+S), before the state update has rendered.
  const latestCells = useRef(props.cells);
  const nextId = useRef(Math.max(0, ...props.cells.map((d) => d.id || 0)) + 1);
  // The keydown listener is registered once; read the current props through this.
  const latestProps = useRef(props);
  latestProps.current = props;

  // Live collaboration (see the controller below): cells report their state
  // through `reporters`; `listeners` hear about local changes.
  const reporters = useRef(new Map());
  const listeners = useRef(new Set());
  const synced = useRef(snapshot(props.cells));

  const setCells = (next, { remote = false } = {}) => {
    latestCells.current = next;
    setCellsState(next);
    const current = snapshot(next);
    if (current === synced.current) return;
    synced.current = current;
    if (!remote) for (const listener of listeners.current) listener(plainCells(next));
  };
  const save = () => latestProps.current.onSave(latestCells.current);

  const onDelete = (id) => {
    setCells(latestCells.current.filter((d) => d.id !== id));
  };
  const onPinToggle = (id) => {
    setCells(
      latestCells.current.map((d) => (d.id === id ? { ...d, pin: !d.pin } : d)),
    );
  };
  const onNew = () => {
    setCells([...latestCells.current, emptyCell(nextId.current++)]);
  };
  const onNewBefore = (index) => {
    setCells(latestCells.current.toSpliced(index, 0, emptyCell(nextId.current++)));
  };
  const onUpdate = (id) => (sourceCode) => {
    setCells(
      latestCells.current.map((d) => (d.id === id ? { ...d, sourceCode } : d)),
    );
  };
  // Keeps the cell's compiled record with it, so the next save stores it and
  // the notebook can later run without loading the compiler.
  const onCompiled = (id) => (compiled) => {
    setCells(
      latestCells.current.map((d) => (d.id === id ? { ...d, compiled } : d)),
    );
  };

  // Remote edits. A cell whose source changes gets a new revision, which
  // remounts it so it runs with the new code.
  const claimId = (id) => {
    const taken = new Set(latestCells.current.map((d) => d.id));
    const chosen = Number.isInteger(id) && id > 0 && !taken.has(id) ? id : nextId.current;
    nextId.current = Math.max(nextId.current, chosen + 1);
    return chosen;
  };
  const indexOf = (id) => {
    const index = latestCells.current.findIndex((d) => d.id === id);
    if (index < 0) throw new Error(`No cell with id ${id}`);
    return index;
  };
  const [controller] = useState(() => ({
    // The cells, in order: [{ id, pin, sourceCode }].
    cells: () => plainCells(latestCells.current),
    // Each cell's live state: status (pending, fulfilled, rejected, error,
    // empty), value, error, exports and rendered text. All cells, or `ids`.
    describe: (ids) =>
      latestCells.current
        .filter((d) => !ids || ids.includes(d.id))
        .map((d) => {
          const report = reporters.current.get(d.id)?.();
          // Until the cell has re-rendered with its latest revision, the
          // mounted instance still shows the previous code: report pending.
          const current = report && report.rev === (d.rev ?? 0) && report.source === (d.sourceCode ?? '');
          const { rev, ...rest } = report ?? {};
          return current ? rest : { id: d.id, pinned: !!d.pin, source: d.sourceCode ?? '', status: 'pending' };
        }),
    insert: ({ id, sourceCode = '', pin = true } = {}, index = latestCells.current.length) => {
      const cell = { id: claimId(id), pin, sourceCode };
      const at = Math.max(0, Math.min(index, latestCells.current.length));
      setCells(latestCells.current.toSpliced(at, 0, cell), { remote: true });
      return cell.id;
    },
    update: (id, { sourceCode, pin } = {}) => {
      const index = indexOf(id);
      const cell = latestCells.current[index];
      const next = { ...cell };
      if (pin !== undefined) next.pin = pin;
      if (sourceCode !== undefined && sourceCode !== cell.sourceCode) {
        Object.assign(next, { sourceCode, rev: (cell.rev ?? 0) + 1 });
      }
      setCells(latestCells.current.with(index, next), { remote: true });
    },
    // Runs a cell again (e.g. to refetch data), without changing it.
    run: (id) => {
      const index = indexOf(id);
      const cell = latestCells.current[index];
      setCells(latestCells.current.with(index, { ...cell, rev: (cell.rev ?? 0) + 1 }), { remote: true });
    },
    remove: (id) => {
      indexOf(id);
      setCells(latestCells.current.filter((d) => d.id !== id), { remote: true });
    },
    move: (id, index) => {
      const cell = latestCells.current[indexOf(id)];
      const rest = latestCells.current.filter((d) => d.id !== id);
      setCells(rest.toSpliced(Math.max(0, Math.min(index, rest.length)), 0, cell), { remote: true });
    },
    // Replaces all cells (e.g. with the server's copy), rerunning changed ones.
    replace: (cells) => {
      const current = new Map(latestCells.current.map((d) => [d.id, d]));
      const next = cells.map(({ id, pin, sourceCode = '' }) => {
        const existing = current.get(id);
        if (!existing) return { id: claimId(id), pin: !!pin, sourceCode };
        return existing.sourceCode === sourceCode
          ? { ...existing, pin: !!pin }
          : { ...existing, pin: !!pin, sourceCode, rev: (existing.rev ?? 0) + 1 };
      });
      setCells(next, { remote: true });
    },
    // Evaluates an expression in the notebook without adding a cell.
    evaluate: (source, options) => notebook.evaluate(source, options),
    // Calls listener(cells) after each local change; returns an unsubscribe.
    subscribe: (listener) => {
      listeners.current.add(listener);
      return () => listeners.current.delete(listener);
    },
  }));

  useEffect(() => {
    // Iridium's width: the notebook's content width, following resizes. A
    // built-in rather than a variable, so a notebook may define its own width.
    main.builtin('width', ['Generators'], (Generators) => {
      let previous = null;
      return Generators.observe((change) => {
        const observer = new ResizeObserver((entries) => {
          const width = entries.at(-1).contentRect.width - 28;
          if (width !== previous) change((previous = width));
        });
        observer.observe(ref.current);
        return () => observer.disconnect();
      });
    });

    // Hand main and the controller to the embedding page: main to define
    // variables from outside, the controller to edit and inspect cells (e.g.
    // a live collaborator such as an assistant working through a server).
    props.onReady(main, controller);

    const onKeyDown = (event) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
        event.preventDefault();
        save();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, []);

  useEffect(() => {
    props._cells(cells);
  }, [cells]);

  return html`<div class="IridiumNotebook" ref=${ref}>
    <div class="IridiumHeader">
      <div class="IridiumTitle">../${props.title || ''}</div>
      <${IridiumIconButton}
        content="Save"
        style="float:right;"
        onClick=${save}
        name="journal-arrow-up"
      />
    </div>
    ${cells.map(
      (cell, index) => html`<${IridiumCell}
        key=${`${cell.id}:${cell.rev ?? 0}`}
        id=${cell.id}
        rev=${cell.rev ?? 0}
        index=${index}
        notebook=${notebook}
        register=${(id, reporter) => reporters.current.set(id, reporter)}
        unregister=${(id, reporter) => {
          if (reporters.current.get(id) === reporter) reporters.current.delete(id);
        }}
        onDelete=${() => onDelete(cell.id)}
        onPinToggle=${() => onPinToggle(cell.id)}
        onUpdate=${onUpdate(cell.id)}
        compiled=${cell.compiled}
        onCompiled=${onCompiled(cell.id)}
        addBefore=${() => onNewBefore(index)}
        sourceCode=${cell.sourceCode}
        pinned=${cell.pin}
      />`,
    )}
    <div class="CellsAfter">
      <${IridiumIconButton} content="New" name="plus-square" onClick=${onNew} />
    </div>
  </div>`;
};

export default IridiumNotebook;
