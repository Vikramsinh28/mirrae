/**
 * Bundles the embeddable widget (src/widget) into one minified file, public/widget.js, served at /widget.js.
 *   node scripts/build-widget.mjs          build once
 *   node scripts/build-widget.mjs --watch  rebuild on change
 */
import { gzipSync } from 'node:zlib';
import { readFile } from 'node:fs/promises';

import { build, context } from 'esbuild';

const OUTFILE = 'public/widget.js';
const options = {
  entryPoints: ['src/widget/index.ts'],
  bundle: true,
  minify: true,
  format: 'iife',
  // Runs on merchants' storefronts, so keep the syntax conservative
  target: ['es2019'],
  outfile: OUTFILE,
  legalComments: 'none',
  logLevel: 'warning',
};

async function report() {
  const bytes = await readFile(OUTFILE);
  console.log(`widget built: ${OUTFILE} ${(bytes.length / 1024).toFixed(1)} KB (${(gzipSync(bytes).length / 1024).toFixed(1)} KB gzip)`);
}

if (process.argv.includes('--watch')) {
  const watcher = await context(options);
  await watcher.watch();
  console.log(`watching src/widget, writing ${OUTFILE}`);
} else {
  await build(options);
  await report();
}
