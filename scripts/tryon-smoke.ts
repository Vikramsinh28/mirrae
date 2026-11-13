/**
 * Real-provider smoke test for the try-on pipeline. Spends one fal.ai request.
 *
 *   node --env-file=.env scripts/tryon-smoke.mjs <person-image> <garment-image> [out-file]
 *
 * Each image is a local file path or an https URL. Local files are sent to fal.ai as data URIs.
 * Runs only the provider module (src/services/external/tryon.ts): no database, no storage,
 * no credits. Prints elapsed time so latency and cost per try-on can be recorded.
 */
import { readFile, writeFile } from 'node:fs/promises';
import { extname } from 'node:path';

import { runTryOn } from '../src/services/external/tryon.ts';

const MAX_LOCAL_BYTES = 8 * 1024 * 1024;
const MIME_BY_EXTENSION = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
};

async function toImageInput(source) {
  if (source.startsWith('https://')) return source;

  const mime = MIME_BY_EXTENSION[extname(source).toLowerCase()];
  if (!mime) throw new Error(`Unsupported image type for "${source}" (use jpg, png or webp)`);

  const bytes = await readFile(source);
  if (bytes.byteLength > MAX_LOCAL_BYTES) {
    throw new Error(`"${source}" is over 8 MB; resize it or pass an https URL instead`);
  }
  return `data:${mime};base64,${bytes.toString('base64')}`;
}

async function main() {
  const [personSource, garmentSource, outFile] = process.argv.slice(2);
  if (!personSource || !garmentSource) {
    console.error('Usage: node --env-file=.env scripts/tryon-smoke.mjs <person> <garment> [out-file]');
    process.exit(2);
  }
  if (!process.env.FAL_KEY) {
    console.error('FAL_KEY is not set in .env');
    process.exit(2);
  }

  const personImageUrl = await toImageInput(personSource);
  const productImageUrl = await toImageInput(garmentSource);

  console.log('Sending both images to fal.ai (one billable request)...');
  const startedAt = Date.now();
  const { resultUrl } = await runTryOn({ personImageUrl, productImageUrl });
  const seconds = ((Date.now() - startedAt) / 1000).toFixed(1);

  console.log(`Done in ${seconds}s`);
  console.log(`Result: ${resultUrl}`);

  if (outFile) {
    const response = await fetch(resultUrl);
    await writeFile(outFile, Buffer.from(await response.arrayBuffer()));
    console.log(`Saved to ${outFile}`);
  }
}

main().catch(error => {
  console.error('Smoke test failed:', error instanceof Error ? error.message : error);
  process.exit(1);
});
