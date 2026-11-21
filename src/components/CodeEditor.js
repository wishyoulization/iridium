import { html } from 'htm/preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import { CodeJar } from 'codejar';

import hljs from 'highlight.js/lib/core';
import javascript from 'highlight.js/lib/languages/javascript';
import xml from 'highlight.js/lib/languages/xml';
import css from 'highlight.js/lib/languages/css';
hljs.registerLanguage('javascript', javascript);
hljs.registerLanguage('xml', xml);
hljs.registerLanguage('css', css);

const highlight = (editor) => {
  // highlight.js does not strip its previous markup, so reset to plain text.
  editor.textContent = editor.textContent;
  // highlight.js >= 11.8 skips elements it has already highlighted.
  delete editor.dataset.highlighted;
  hljs.highlightElement(editor);
};

const CodeEditor = (props) => {
  const ref = useRef(null);
  const [code, setCode] = useState(props.code);

  useEffect(() => {
    const jar = CodeJar(ref.current, highlight, {
      tab: '\t',
      indentOn: /[(\[]$/,
      addClosing: false,
      spellcheck: false,
    });
    jar.updateCode(code);
    jar.onUpdate(setCode);

    // Lets the cell replace the code, e.g. after formatting it.
    props.onReady({
      setter: (next) => {
        setCode(next);
        jar.updateCode(next);
      },
    });

    return () => jar.destroy();
  }, []);

  useEffect(() => {
    props.onUpdate?.(code);
  }, [code]);

  return html`<div class="EditorWrapper" tabindex=${props.index}>
    <div
      ref=${ref}
      class="CodeEditor editor language-js"
      onKeyDown=${props.onKeyDown}
    ></div>
  </div>`;
};

export default CodeEditor;
