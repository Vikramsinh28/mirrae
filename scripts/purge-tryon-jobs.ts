/**
 * Deletes finished try-on records (DONE or FAILED) older than the retention period. Records hold no photo.
 * A dry run is the default: it only says how many records would go.
 *
 *   npx tsx --env-file=.env scripts/purge-tryon-jobs.ts              # dry run, 180 days
 *   npx tsx --env-file=.env scripts/purge-tryon-jobs.ts --days 365   # dry run, 365 days
 *   npx tsx --env-file=.env scripts/purge-tryon-jobs.ts --apply      # really delete
 *
 * The minimum is 90 days (the dashboard shows up to 90 days of usage). Run it from a scheduler, for example monthly.
 */
import { prisma } from '../src/lib/prisma';
import { DEFAULT_RETENTION_DAYS, MIN_RETENTION_DAYS, purgeOldTryOnJobs } from '../src/services/internal/tryon-retention';

function readDays(argv: string[]): number | undefined {
  const index = argv.indexOf('--days');
  if (index === -1) return undefined;
  const value = argv[index + 1];
  if (value === undefined || !/^\d+$/.test(value)) throw new Error('--days needs a whole number');
  return Number(value);
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const known = new Set(['--days', '--apply']);
  const unknown = argv.filter(arg => arg.startsWith('--') && !known.has(arg));
  if (unknown.length > 0) throw new Error(`Unknown option ${unknown[0]}. Options: --days <n> (min ${MIN_RETENTION_DAYS}, default ${DEFAULT_RETENTION_DAYS}), --apply`);

  const result = await purgeOldTryOnJobs({ days: readDays(argv), apply: argv.includes('--apply') });
  const when = result.cutoff.toISOString();
  console.log(
    result.applied
      ? `Deleted ${result.deleted} try-on records created before ${when}.`
      : `Dry run: ${result.matched} try-on records created before ${when} would be deleted. Add --apply to delete them.`
  );
}

main()
  .catch(error => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
