import { html } from 'htm/preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import { Inspector } from '@observablehq/runtime';
import CodeEditor from './CodeEditor.js';
import beautify from 'js-beautify';

const IridiumCell = (props) => {
  const ref = useRef(null);
  const [error, _error] = useState(null);
  const [sourceCode, _sourceCode] = useState(props.sourceCode || '');
  const [savedSourceCode, _savedSourceCode] = useState(null);
  const [variables, _variables] = useState(null);
  const unsaved = savedSourceCode !== sourceCode;

  const _onDelete = () => {
    props.onDelete();
    if (variables) variables.map((v) => v.delete());
  };

  const _onSave = () => {
    _savedSourceCode(sourceCode);
    props.onUpdate(sourceCode);

    if (variables) {
      for (const v of variables) {
        v.delete();
        if (v._observer._node) {
          v._observer._node.remove();
        }
      }
    }

    const observer = (name) => {
      const child = ref.current.appendChild(document.createElement('div'));
      return new Inspector(child);
    };

    props.interpreter
      .cell(sourceCode, null, observer)
      .then((newVars) => {
        _error(null);
        _variables(newVars);
      })
      .catch((e) => {
        _error(e);
        console.warn(e);
      });
  };

  const _onTextAreaInput = (v) => {
    return _sourceCode(v);
  };

  const _onTextAreaKeypress = (event) => {
    // shift+enter
    if (event.keyCode === 13 && event.shiftKey) {
      event.preventDefault();
      _onSave();
    } else if (
      (event.ctrlKey || event.metaKey) &&
      (event.key === 's' || event.key === 'S')
    ) {
      //ctrl/cmd+s
      event.preventDefault();
      _onSave();
      props.saveNotebook();
    }
  };
  useEffect(() => {
    if (ref.current && sourceCode) {
      _onSave();
    }
  }, []);

  let cell_type = '';
  if (variables && variables.length > 1) {
    //var list = variables.map((d) => d._name);
    if (variables[0]._name && variables[0]._name.indexOf('viewof') > -1) {
      cell_type = 'viewof';
    } else if (
      variables[0]._name &&
      variables[0]._name.indexOf('initial') > -1
    ) {
      cell_type = 'mutable';
    }
  }

  return html`<div
    class=${`IridiumCell ${props.pinned ? 'Pinned' : 'UnPinned'}`}
  >
    <div style=${`display: ${error ? 'block' : 'none'}`} class="CellError">
      <div class="observablehq observablehq--error">
        <div class="observablehq--inspect">${error + ''}</div>
      </div>
    </div>
    <div
      ref=${ref}
      class=${`CellResults ${cell_type}`}
      style=${`display: ${!error ? 'block' : 'none'}`}
    ></div>
    <div class="CellBefore">
      <sl-icon-button
        name="plus-square"
        label="New"
        onClick=${props.addBefore}
      ></sl-icon-button>
    </div>
    <div class="CellActions" onClick=${props.onPinToggle}>
      <sl-icon-button
        name=${props.pinned ? 'pin-angle-fill' : 'pin-angle'}
        label="pin"
      ></sl-icon-button>
    </div>
    ${props.pinned
      ? html`<div class="CellContainer">
          <${CodeEditor}
            code=${sourceCode}
            index=${props.index}
            unsaved=${unsaved}
            onUpdate=${_onTextAreaInput}
            onKeypress=${_onTextAreaKeypress}
          />
          <div class="CellEditorActions">
            <sl-icon-button
              name="trash2"
              label="Delete"
              onClick=${_onDelete}
            ></sl-icon-button>
            <sl-icon-button
              name="text-indent-left"
              label="Indent"
              style="font-size: 1.25rem;"
              onClick=${() => {
                var formatted = beautify(sourceCode, {});
                _sourceCode(formatted);
              }}
            ></sl-icon-button>
            <sl-icon-button
              name=${unsaved ? 'play-fill' : 'play'}
              label="Run"
              style="font-size: 1.25rem;"
              onClick=${_onSave}
            ></sl-icon-button>
          </div>
        </div>`
      : null}
  </div>`;
};

export default IridiumCell;
