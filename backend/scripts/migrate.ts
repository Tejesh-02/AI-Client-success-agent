/**
 * Run the Supabase/Postgres migration (creates all tables).
 * Requires DATABASE_URL in .env (Supabase: Project Settings → Database → Connection string URI).
 *
 * Usage: npm --workspace backend run migrate
 *        or from backend: npm run migrate
 */
import "dotenv/config";
import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import pkg from "pg";
const { Client } = pkg;

const __dirname = dirname(fileURLToPath(import.meta.url));
const migrationsDir = join(__dirname, "../db/migrations");

async function migrate() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error("Missing DATABASE_URL. Set it in backend/.env (Supabase: Project Settings → Database → Connection string URI).");
    process.exit(1);
  }

  const files = readdirSync(migrationsDir)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  const client = new Client({ connectionString });

  try {
    await client.connect();
    for (const file of files) {
      const sql = readFileSync(join(migrationsDir, file), "utf8");
      await client.query(sql);
      console.log("Migration completed:", file);
    }
  } catch (err) {
    console.error("Migration failed:", err instanceof Error ? err.message : err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

migrate();
