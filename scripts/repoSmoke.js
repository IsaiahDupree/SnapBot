import dotenv from 'dotenv';
import pool from '../db/pool.js';
import { createJob, getJob, listRuns, createRun, finishRun, updateJobStatus } from '../db/repositories.js';

dotenv.config();

async function main() {
  if (!pool) throw new Error('DATABASE_URL not configured');
  const client = await pool.connect();
  client.release();
  console.log('DB connected.');

  // Create a dummy job
  const { id } = await createJob({ type: 'sendSnap', payload: { category: 'BestFriends', caption: 'Test' } });
  console.log('Created job:', id);

  await updateJobStatus(id, 'queued');
  const run = await createRun(id);
  console.log('Created run:', run.id);

  await finishRun(run.id, 'succeeded', null);
  await updateJobStatus(id, 'succeeded');

  const job = await getJob(id);
  const runs = await listRuns(id);
  console.log('Job status:', job.status);
  console.log('Runs:', runs.map(r => ({ id: r.id, status: r.status })));

  await pool.end();
}

main().catch(async (e) => {
  console.error('Smoke test failed:', e);
  try { await pool?.end(); } catch {}
  process.exit(1);
});
