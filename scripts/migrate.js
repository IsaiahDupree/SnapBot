import fs from 'fs';
import path from 'path';
import url from 'url';
import dotenv from 'dotenv';
import pool from '../db/pool.js';

dotenv.config();

const __filename = url.fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function ensureConnected() {
  if (!pool) throw new Error('DATABASE_URL not configured');
  const client = await pool.connect();
  client.release();
}

async function runMigrations() {
  await ensureConnected();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
      id TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ DEFAULT now()
    )`);

    const migrationsDir = path.join(__dirname, '..', 'migrations');
    if (!fs.existsSync(migrationsDir)) {
      console.log('No migrations directory found. Nothing to migrate.');
      await client.query('COMMIT');
      return;
    }

    const files = fs
      .readdirSync(migrationsDir)
      .filter((f) => f.endsWith('.sql'))
      .sort();

    for (const file of files) {
      const id = file;
      const res = await client.query('SELECT 1 FROM schema_migrations WHERE id=$1', [id]);
      if (res.rowCount > 0) {
        console.log(`Already applied: ${id}`);
        continue;
      }

      const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf-8');
      console.log(`Applying migration: ${id}`);
      await client.query(sql);
      await client.query('INSERT INTO schema_migrations (id) VALUES ($1)', [id]);
    }

    await client.query('COMMIT');
    console.log('Migrations complete.');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Migration failed:', err);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end().catch(() => {});
  }
}

runMigrations();
