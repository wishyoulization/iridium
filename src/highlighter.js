// highlight.js with the grammars Iridium uses. Loaded on demand (a separate
// chunk): by editors once they become visible, and by the compiler.
import hljs from 'highlight.js/lib/core';
import javascript from 'highlight.js/lib/languages/javascript';
import xml from 'highlight.js/lib/languages/xml';
import css from 'highlight.js/lib/languages/css';

hljs.registerLanguage('javascript', javascript);
hljs.registerLanguage('xml', xml); // HTML inside html`…`
hljs.registerLanguage('css', css); // CSS inside <style>

export default hljs;
