import dotenv from 'dotenv';
import pool from '../db/pool.js';

dotenv.config();

async function main() {
  if (!pool) {
    console.error('No DATABASE_URL configured');
    process.exit(1);
  }
  const res = await pool.query('SELECT NOW() AS now');
  console.log('DB OK:', res.rows[0].now);
  await pool.end();
}

main().catch((e) => {
  console.error('DB health check failed:', e);
  process.exit(1);
});
