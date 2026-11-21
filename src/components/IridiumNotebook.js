import { html } from 'htm/preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import { createNotebook } from '../notebook.js';

import IridiumIconButton from './IridiumIconButton.js';
import IridiumCell from './IridiumCell.js';

const emptyCell = (id) => ({ id, pin: true, sourceCode: '' });

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

  const setCells = (next) => {
    latestCells.current = next;
    setCellsState(next);
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

  useEffect(() => {
    // Iridium's width: the notebook's content width, following resizes.
    main.define('width', ['Generators'], (Generators) => {
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

    // Hand main to the embedding page, e.g. to define variables from outside.
    props.onReady(main);

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
        key=${cell.id}
        index=${index}
        notebook=${notebook}
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
