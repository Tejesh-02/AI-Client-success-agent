# ClientPulse

Monorepo with:
- `apps/internal-dashboard` (internal CS dashboard)
- `apps/customer-chat` (hosted customer AI chat)
- `backend` (shared API core)
- `packages/types` (shared types)

See `docs/architecture/` for split architecture docs.

Key runtime defaults:
- Database: Supabase Postgres (`SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`)
- Internal auth: email/password login + JWT bearer token
- AI provider: Groq by default (`AI_PROVIDER=groq`)
