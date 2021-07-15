import { html } from 'htm/preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import { CodeJar } from 'codejar';
import hljs from 'highlight.js/lib/common';

const CodeEditor = (props) => {
  const ref = useRef(null);
  const [code, _code] = useState(props.code);
  const [jar, _jar] = useState(null);

  useEffect(() => {
    if (ref && ref.current) {
      const cj = CodeJar(
        ref.current,
        (editor) => {
          // highlight.js does not trim old tags,
          // let's do it by this hack.
          editor.textContent = editor.textContent;
          hljs.highlightElement(editor, { language: 'js' });
        },
        {
          tab: '\t',
          indentOn: /[(\[]$/,
          addClosing: false,
          spellcheck: true,
        },
      );

      cj.updateCode(code);
      cj.onUpdate((code) => {
        _code(code);
      });

      _jar(cj);
    }
    return () => {
      jar && jar.destroy();
    };
  }, []);

  useEffect(() => {
    if (props.onUpdate) {
      props.onUpdate(code);
    }
  }, [code]);

  useEffect(() => {
    if (props.code !== code) {
      jar && jar.updateCode(props.code);
    }
  }, [props.code]);

  return html`<div class="EditorWrapper" tabindex=${props.index + ''}>
    <div
      ref=${ref}
      class="CodeEditor editor language-js"
      onKeyDown=${props.onKeypress}
    ></div>
  </div> `;
};

export default CodeEditor;