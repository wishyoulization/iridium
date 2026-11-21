import { html } from 'htm/preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import { CodeJar } from 'codejar';

// highlight.js loads on demand, when the first editor becomes visible, so
// notebooks shown without editors (view-only embeds) never download it.
let hljs = null;
let loading = null;
const loadHighlighter = () =>
  (loading ??= import('../highlighter.js').then((module) => (hljs = module.default)));

const highlight = (editor) => {
  if (!hljs) return; // plain text until highlight.js has loaded
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
    const element = ref.current;
    const jar = CodeJar(element, highlight, {
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

    // Highlight once the editor is on screen, keeping the caret in place.
    const visibility = new IntersectionObserver((entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) return;
      visibility.disconnect();
      loadHighlighter().then(() => {
        if (!element.isConnected) return;
        const caret = element.contains(document.activeElement) ? jar.save() : null;
        highlight(element);
        if (caret) jar.restore(caret);
      });
    });
    visibility.observe(element);

    return () => {
      visibility.disconnect();
      jar.destroy();
    };
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
