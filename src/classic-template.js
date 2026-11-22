// Observable's classic `html` and `svg` tagged templates, from
// @observablehq/stdlib (ISC License, Copyright 2018-2022 Observable, Inc.).
//
// Classic Observable JavaScript notebooks, including notebooks imported from
// observablehq.com, rely on these semantics: interpolated strings (and arrays
// of strings) are inserted as markup, nodes are inserted as nodes, and an
// empty template yields an empty element. Notebook Kit's `html`/`svg` are
// Hypertext Literal, which escapes strings instead; that stays available as
// `htl` (htl.html, htl.svg).

function template(render, wrapper) {
  return function (strings, ...values) {
    let string = strings[0];
    const parts = [];
    let root = null;
    let k = -1;

    // Concatenate the text using comments as placeholders for nodes.
    for (let i = 0; i < values.length; ++i) {
      const part = values[i];
      if (part instanceof Node) {
        parts[++k] = part;
        string += `<!--o:${k}-->`;
      } else if (Array.isArray(part)) {
        for (const node of part) {
          if (node instanceof Node) {
            if (root === null) {
              parts[++k] = root = document.createDocumentFragment();
              string += `<!--o:${k}-->`;
            }
            root.appendChild(node);
          } else {
            root = null;
            string += node;
          }
        }
        root = null;
      } else {
        string += part;
      }
      string += strings[i + 1];
    }

    // Render the text, then swap the placeholders for the nodes.
    root = render(string);
    if (++k > 0) {
      const nodes = new Array(k);
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_COMMENT, null);
      while (walker.nextNode()) {
        const node = walker.currentNode;
        if (/^o:/.test(node.nodeValue)) nodes[+node.nodeValue.slice(2)] = node;
      }
      for (let i = 0; i < k; ++i) {
        const node = nodes[i];
        if (node) node.parentNode.replaceChild(parts[i], node);
      }
    }

    // A single child is returned as is; a fragment is wrapped in an element.
    return root.childNodes.length === 1
      ? root.removeChild(root.firstChild)
      : root.nodeType === 11
        ? (() => {
            const node = wrapper();
            node.appendChild(root);
            return node;
          })()
        : root;
  };
}

export const html = template(
  (string) => {
    const element = document.createElement('template');
    element.innerHTML = string.trim();
    return document.importNode(element.content, true);
  },
  () => document.createElement('span'),
);

export const svg = template(
  (string) => {
    const root = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    root.innerHTML = string.trim();
    return root;
  },
  () => document.createElementNS('http://www.w3.org/2000/svg', 'g'),
);
