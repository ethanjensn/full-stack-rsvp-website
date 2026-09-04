import { neon } from "@neondatabase/serverless";

export function getDb(env) {
  if (!env.DATABASE_URL) {
    throw new Error("DATABASE_URL environment variable is not set");
  }
  return neon(env.DATABASE_URL);
}

export async function initDb(sql) {
  await sql`
    CREATE TABLE IF NOT EXISTS rsvps (
      id SERIAL PRIMARY KEY,
      created_at TIMESTAMPTZ NOT NULL,
      first_name TEXT NOT NULL,
      last_name TEXT NOT NULL,
      email TEXT NOT NULL,
      phone TEXT NOT NULL,
      attendance TEXT NOT NULL,
      party_size INTEGER NOT NULL,
      guests_json TEXT NOT NULL DEFAULT '[]',
      song_request TEXT
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL
    )
  `;
}
