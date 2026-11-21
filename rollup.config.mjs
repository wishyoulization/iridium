import { nodeResolve } from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import terser from '@rollup/plugin-terser';
import { visualizer } from 'rollup-plugin-visualizer';
import { fileURLToPath } from 'node:url';
import * as sass from 'sass';

// Compiles imported .scss files and injects them into <head> at runtime.
const scss = () => ({
  name: 'scss',
  transform(_code, id) {
    if (!id.endsWith('.scss')) return null;
    const { css, loadedUrls } = sass.compile(id, { style: 'compressed' });
    for (const url of loadedUrls) {
      if (url.protocol === 'file:') this.addWatchFile(fileURLToPath(url));
    }
    return {
      code: `const css = ${JSON.stringify(css)};
if (typeof document !== 'undefined') {
  const style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);
}
export default css;`,
      map: { mappings: '' },
    };
  },
});

export default {
  input: 'src/index.js',
  output: {
    file: 'dist/iridium.js',
    // IIFE keeps minified internals off window; the bundle exposes window.Iridium itself.
    format: 'iife',
    name: 'IridiumApp',
  },
  plugins: [
    nodeResolve({
      browser: true,
    }),
    commonjs(),
    scss(),
    terser(),
    visualizer(),
  ],
};
