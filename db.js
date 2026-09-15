import pg from 'pg';

const { Pool } = pg;

// DATABASE_SSL=true is needed for hosted Postgres reached over the public
// internet (e.g. a Render database's external connection string). Render's
// internal connection string, and a local Postgres, don't need it.
export const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/simple_streamer',
  ...(process.env.DATABASE_SSL === 'true' ? { ssl: { rejectUnauthorized: false } } : {}),
});
