/**
 * Real-provider smoke test for the try-on pipeline. Spends one Vertex AI request
 * (plus two Gemini image requests with --views).
 *
 *   npx tsx --env-file=.env scripts/tryon-smoke.ts <person-image> <garment-image> [out-prefix] [--views]
 *
 * Each image is a local JPEG, PNG or WebP file. It is normalised exactly like the app does
 * (orientation, letterbox bars, size, JPEG) before being sent. Writes <out-prefix>.png, and with
 * --views also <out-prefix>-side.png and <out-prefix>-back.png.
 * Runs only the provider modules: no database, no storage, no credits. Prints elapsed time.
 * Needs GOOGLE_CLOUD_PROJECT and Google credentials (see src/services/external/vertex-client.ts).
 */
import { readFile, writeFile } from 'node:fs/promises';

import { runTryOn } from '../src/services/external/tryon';
import { generateExtraView } from '../src/services/external/tryon-views';
import { prepareTryOnImage } from '../src/services/internal/tryon-image';

const EXTRA_VIEWS = ['side', 'back'] as const;

const secondsSince = (startedAt: number) => ((Date.now() - startedAt) / 1000).toFixed(1);

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const withViews = args.includes('--views');
  const [personPath, garmentPath, outPrefix = 'tryon-result'] = args.filter(arg => arg !== '--views');
  if (!personPath || !garmentPath) {
    console.error('Usage: npx tsx --env-file=.env scripts/tryon-smoke.ts <person> <garment> [out-prefix] [--views]');
    process.exit(2);
  }
  if (!process.env.GOOGLE_CLOUD_PROJECT) {
    console.error('GOOGLE_CLOUD_PROJECT is not set in .env');
    process.exit(2);
  }

  const person = await prepareTryOnImage(await readFile(personPath));
  const garment = await prepareTryOnImage(await readFile(garmentPath));

  console.log('Sending both images to Vertex AI (one billable request)...');
  const frontStartedAt = Date.now();
  const { image } = await runTryOn({ personImageBase64: person.base64, productImageBase64: garment.base64 });
  await writeFile(`${outPrefix}.png`, image.bytes);
  console.log(`Front view done in ${secondsSince(frontStartedAt)}s -> ${outPrefix}.png`);

  if (!withViews) return;

  console.log('Generating side and back views (two billable Gemini requests)...');
  const viewsStartedAt = Date.now();
  await Promise.all(
    EXTRA_VIEWS.map(async view => {
      try {
        const extra = await generateExtraView({
          view,
          frontImage: image,
          garmentBase64: garment.base64,
          garmentContentType: garment.contentType,
        });
        await writeFile(`${outPrefix}-${view}.png`, extra.bytes);
        console.log(`${view} view done -> ${outPrefix}-${view}.png`);
      } catch (error) {
        console.error(`${view} view failed:`, error instanceof Error ? error.message : error);
      }
    })
  );
  console.log(`Extra views took ${secondsSince(viewsStartedAt)}s`);
}

main().catch(error => {
  console.error('Smoke test failed:', error instanceof Error ? error.message : error);
  process.exit(1);
});
