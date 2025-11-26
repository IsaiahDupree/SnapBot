import { Pool } from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const { DATABASE_URL } = process.env;

if (!DATABASE_URL) {
  console.warn('DATABASE_URL is not set. DB features will be disabled until provided.');
}

const pool = DATABASE_URL
  ? new Pool({ connectionString: DATABASE_URL })
  : null;

export default pool;
