/**
 * Migration runner — `npm run db:migrate --workspace @kapar/server`.
 *
 * Applies `apps/server/migrations/*.sql` in filename order, each inside its own
 * transaction, recording applied names in `schema_migrations`. Re-running is a no-op
 * for already-applied files. No down-migrations in M1 — forward-only, like production.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pgPool } from './pool';

const MIGRATIONS_DIR = join(__dirname, '..', '..', 'migrations');

async function migrate(): Promise<void> {
  await pgPool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      name       text PRIMARY KEY,
      applied_at timestamptz NOT NULL DEFAULT now()
    )
  `);

  const applied = new Set(
    (await pgPool.query<{ name: string }>('SELECT name FROM schema_migrations')).rows.map(
      (r) => r.name,
    ),
  );

  const files = readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  let ran = 0;
  for (const file of files) {
    if (applied.has(file)) {
      continue;
    }
    const sql = readFileSync(join(MIGRATIONS_DIR, file), 'utf8');
    const client = await pgPool.connect();
    try {
      await client.query('BEGIN');
      await client.query(sql);
      await client.query('INSERT INTO schema_migrations (name) VALUES ($1)', [file]);
      await client.query('COMMIT');
      ran += 1;
      // eslint-disable-next-line no-console
      console.log(`applied ${file}`);
    } catch (err) {
      await client.query('ROLLBACK');
      // eslint-disable-next-line no-console
      console.error(`FAILED ${file}`);
      throw err;
    } finally {
      client.release();
    }
  }
  // eslint-disable-next-line no-console
  console.log(ran === 0 ? 'nothing to apply — schema is current' : `done — ${ran} migration(s) applied`);
}

migrate()
  .then(() => pgPool.end())
  .catch((err) => {
    // eslint-disable-next-line no-console
    console.error(err);
    process.exitCode = 1;
    return pgPool.end();
  });
