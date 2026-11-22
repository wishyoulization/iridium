import { html, render } from 'htm/preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import IridiumNotebook from './components/IridiumNotebook.js';

import './editor.scss';
import './inspector.scss';

const sources = (cells) => JSON.stringify((cells ?? []).map((d) => d.sourceCode));

const IridiumApp = ({ Ir }) => {
  const [current, setCurrent] = useState(Ir.get_recent() || null);
  const [cells, setCells] = useState(null);
  const [savedCells, setSavedCells] = useState([]);
  const [list, setList] = useState([]);

  useEffect(() => {
    Ir.set_recent(current);
    Ir.load(current).then((loaded) => {
      setCells(loaded ?? []);
      setSavedCells(loaded ?? []);
    });
  }, [current]);

  const refreshList = () =>
    Ir.list().then((all) => {
      if (all.length) setList(all);
    });

  useEffect(() => {
    refreshList();
  }, []);

  const onSave = (cells) => Ir.save(current, cells).then(() => setSavedCells(cells));

  const unchanged = sources(cells) === sources(savedCells);

  return html`<div
    class="IridiumApp ${unchanged ? 'IridiumNotebookSaved' : 'IridiumNotebookUnsaved'}"
  >
    ${cells
      ? html`<${IridiumNotebook}
          title=${current}
          cells=${cells}
          onSave=${onSave}
          onReady=${(main, controller) => Ir.ready(main, controller)}
          doRefresh=${refreshList}
          list=${list}
          _current=${setCurrent}
          _cells=${setCells}
        />`
      : null}
  </div>`;
};

// The embedding API. Pages may override load/save/list/new/delete/ready, e.g.
// to store notebooks somewhere other than localStorage.
window.Iridium = {
  IridiumApp,
  html,
  render,
  useEffect,
  useRef,
  useState,
  save: async (name, cells) => localStorage.setItem(String(name), JSON.stringify(cells)),
  new: async (name) => localStorage.setItem(String(name), JSON.stringify([])),
  load: async (name) => JSON.parse(localStorage.getItem(String(name))),
  list: async () => Object.keys(localStorage),
  delete: (name) => localStorage.removeItem(name),
  get_recent: () => localStorage.getItem('IridiumRecent'),
  set_recent: (name) => (name ? localStorage.setItem('IridiumRecent', name) : false),
  // Called with the notebook's main module and its controller (edit and
  // inspect cells from outside; see IridiumNotebook.js).
  ready: (main, controller) => {
    window.IridiumMain = main;
    window.IridiumController = controller;
  },
};
