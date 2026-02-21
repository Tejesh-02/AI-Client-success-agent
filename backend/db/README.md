# Database (Supabase / Postgres)

## First-time setup

1. **Env in `backend/.env`** (same Supabase project):
   - **DATABASE_URL** – Project Settings → Database → Connection string (URI). Password with `@` → use `%40`.
   - **SUPABASE_URL** – Project Settings → API → Project URL.
   - **SUPABASE_SERVICE_ROLE_KEY** – Project Settings → API → service_role key.
   - **JWT_SECRET** – any long random string (for dashboard login).

2. **Create tables and seed company + user** (one command):
   ```bash
   cd backend && npm run db:setup
   ```
   Or from repo root: `npm --workspace backend run db:setup`  
   This runs migration then seed (company **acme**, user **manager@acme.test** / **password123**).

3. **Start the backend** (must be running for dashboard and customer chat):
   ```bash
   npm run dev
   ```
   From repo root. Backend listens on http://localhost:4000.

4. **Log in**: dashboard **acme** / **manager@acme.test** / **password123**. Customer chat: open http://localhost:5173/chat/acme and Start chat.

## Migrations

- SQL files live in `backend/db/migrations/`.
- `npm run migrate` runs all `.sql` files in order (e.g. `0001_split_architecture.sql`, `0002_company_documents.sql`).
- `0002_company_documents.sql` adds `company_documents` (company knowledge base for the AI). Re-running is safe (`CREATE TABLE IF NOT EXISTS`).
