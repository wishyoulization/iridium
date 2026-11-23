import { nodeResolve } from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import terser from '@rollup/plugin-terser';
import { visualizer } from 'rollup-plugin-visualizer';
import { rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import * as sass from 'sass';

// Compiles imported .scss/.css files and injects them into <head> at runtime.
const styles = () => ({
  name: 'styles',
  transform(_code, id) {
    if (!/\.s?css$/.test(id)) return null;
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

// Chunk names are content-hashed, so clear out the previous build's chunks.
const cleanChunks = () => ({
  name: 'clean-chunks',
  buildStart() {
    rmSync('dist/chunks', { recursive: true, force: true });
  },
});

export default {
  input: 'src/index.js',
  // Notebook Kit loads optional libraries (d3, Plot, DuckDB, …) from esm.sh on
  // first use. Leave those URLs as real imports instead of bundling them.
  external: (id) => /^https?:\/\//.test(id),
  output: {
    dir: 'dist',
    // ES modules so Kit's lazy stdlib modules stay separate chunks; inlining
    // them would turn their esm.sh imports into network requests at startup.
    format: 'es',
    entryFileNames: 'iridium.js',
    // No leading underscores (e.g. _commonjsHelpers): GitHub Pages' Jekyll
    // build skips such files, so they would 404 there.
    chunkFileNames: ({ name }) => `chunks/${name.replace(/^_+/, '')}-[hash].js`,
  },
  onwarn(warning, warn) {
    // Circular imports inside Observable's packages are harmless.
    if (warning.code === 'CIRCULAR_DEPENDENCY') return;
    warn(warning);
  },
  plugins: [
    cleanChunks(),
    nodeResolve({
      browser: true,
    }),
    commonjs(),
    styles(),
    terser(),
    visualizer(),
  ],
};
