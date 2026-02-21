# KLEO - AI CLIENT SUCCESS AGENT (Full System Architecture Plan)

## Project Overview

KLEO is an AI-first Client Success Management SaaS platform. Companies onboard onto the platform, configure **KLEO** (the AI Client Success Agent) with their knowledge base and routing rules, and embed the chat widget on their own product. Their clients interact with KLEO, which resolves issues, raises tickets, and routes them to the right team member â€” all visible in real time on the KLEO dashboard.

---

## Repository Structure

This is a **monorepo** â€” one GitHub repository, two separate frontend apps, one shared backend.

```
kleo/
â”‚
â”œâ”€â”€ apps/
â”‚   â”œâ”€â”€ dashboard/              # Internal dashboard (Next.js) â€” for CS teams
â”‚   â””â”€â”€ widget/                 # Chat widget (React + Vite) â€” client-facing embed
â”‚
â”œâ”€â”€ packages/
â”‚   â”œâ”€â”€ ui/                     # Shared UI components (buttons, modals, badges)
â”‚   â”œâ”€â”€ types/                  # Shared TypeScript types across apps
â”‚   â””â”€â”€ utils/                  # Shared utility functions (date formatting, etc.)
â”‚
â”œâ”€â”€ backend/
â”‚   â”œâ”€â”€ src/
â”‚   â”‚   â”œâ”€â”€ api/                # REST API route handlers
â”‚   â”‚   â”‚   â”œâ”€â”€ auth/
â”‚   â”‚   â”‚   â”œâ”€â”€ conversations/
â”‚   â”‚   â”‚   â”œâ”€â”€ tickets/
â”‚   â”‚   â”‚   â”œâ”€â”€ knowledge-base/
â”‚   â”‚   â”‚   â”œâ”€â”€ routing/
â”‚   â”‚   â”‚   â”œâ”€â”€ team/
â”‚   â”‚   â”‚   â”œâ”€â”€ clients/
â”‚   â”‚   â”‚   â”œâ”€â”€ webhooks/
â”‚   â”‚   â”‚   â””â”€â”€ analytics/
â”‚   â”‚   â”œâ”€â”€ ai/                 # KLEO â€” AI agent logic
â”‚   â”‚   â”‚   â”œâ”€â”€ agent.ts        # Core agent orchestration
â”‚   â”‚   â”‚   â”œâ”€â”€ intent.ts       # Intent detection
â”‚   â”‚   â”‚   â”œâ”€â”€ retrieval.ts    # Knowledge base retrieval (RAG)
â”‚   â”‚   â”‚   â”œâ”€â”€ sentiment.ts    # Sentiment + churn detection
â”‚   â”‚   â”‚   â”œâ”€â”€ confidence.ts   # Confidence scoring
â”‚   â”‚   â”‚   â””â”€â”€ handoff.ts      # Human handoff logic
â”‚   â”‚   â”œâ”€â”€ services/
â”‚   â”‚   â”‚   â”œâ”€â”€ email.ts        # Email routing service
â”‚   â”‚   â”‚   â”œâ”€â”€ ticket.ts       # Ticket creation + management
â”‚   â”‚   â”‚   â”œâ”€â”€ webhook.ts      # Webhook event dispatcher
â”‚   â”‚   â”‚   â””â”€â”€ health-score.ts # Client health score calculator
â”‚   â”‚   â”œâ”€â”€ middleware/
â”‚   â”‚   â”‚   â”œâ”€â”€ auth.ts
â”‚   â”‚   â”‚   â”œâ”€â”€ rbac.ts         # Role-based access control
â”‚   â”‚   â”‚   â””â”€â”€ company.ts      # Company context loader
â”‚   â”‚   â”œâ”€â”€ db/
â”‚   â”‚   â”‚   â”œâ”€â”€ schema.ts       # Database schema (Drizzle ORM)
â”‚   â”‚   â”‚   â””â”€â”€ migrations/
â”‚   â”‚   â””â”€â”€ lib/
â”‚   â”‚       â”œâ”€â”€ embeddings.ts   # Vector embedding generation
â”‚   â”‚       â””â”€â”€ realtime.ts     # WebSocket / real-time events
â”‚   â””â”€â”€ package.json
â”‚
â”œâ”€â”€ .agents/
â”‚   â””â”€â”€ plans/
â”‚       â”œâ”€â”€ architecture.md         # This document
â”‚       â”œâ”€â”€ phase-1-core-chat.md
â”‚       â”œâ”€â”€ phase-2-dashboard.md
â”‚       â””â”€â”€ phase-3-advanced.md
â”‚
â”œâ”€â”€ docker-compose.yml
â”œâ”€â”€ turbo.json                  # Turborepo config
â””â”€â”€ package.json                # Root monorepo config
```

---

## Why Two Separate Apps?

| | Dashboard App | Widget App |
|---|---|---|
| **Who uses it** | CS team (internal) | End clients (public) |
| **Auth required** | Yes â€” login with roles | No â€” identified by company ID |
| **Bundle size** | Can be heavy | Must be lightweight (<100kb) |
| **Framework** | Next.js (SSR, SEO, auth) | React + Vite (fast, embeddable) |
| **Deployment** | dashboard.kleo.io | cdn.kleo.io/widget.js |
| **Real-time needs** | Full dashboard updates | Single conversation stream |

They share the same backend API and the same database. The `packages/` folder holds shared types and UI components so there's no duplication.

---

## Tech Stack

### Frontend â€” Dashboard
- **Framework:** Next.js 14 (App Router)
- **Styling:** Tailwind CSS + shadcn/ui
- **State Management:** Zustand
- **Data Fetching:** React Query (TanStack Query)
- **Real-time:** Socket.io client
- **Charts/Analytics:** Recharts
- **Auth:** NextAuth.js

### Frontend â€” Widget
- **Framework:** React 18 + Vite
- **Styling:** Tailwind CSS (scoped to avoid conflicts with host site)
- **State:** React Context + useReducer
- **Real-time:** Socket.io client
- **Output:** Single embeddable JS bundle

### Backend
- **Runtime:** Node.js + TypeScript
- **Framework:** Express.js
- **ORM:** Drizzle ORM
- **Real-time:** Socket.io
- **AI:** OpenAI API (GPT-4o) + LangChain for RAG orchestration
- **Vector DB:** Pgvector (PostgreSQL extension) for knowledge base embeddings
- **Email:** Resend (for routing emails and notifications)
- **Job Queue:** BullMQ + Redis (for async tasks â€” email sending, webhook dispatch)
- **Auth:** JWT + refresh tokens

### Database
- **Primary:** PostgreSQL (via Supabase or Railway for demo)
- **Vector Search:** pgvector extension on the same Postgres instance
- **Cache:** Redis (sessions, rate limiting, job queue)

### Infrastructure (Demo)
- **Backend:** Railway or Render
- **Frontend:** Vercel (both dashboard and widget)
- **Storage:** Cloudflare R2 (knowledge base file uploads)
- **CDN:** Cloudflare (widget JS delivery)

---

## System Architecture Diagram

```
                        â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
                        â”‚        Company's Website      â”‚
                        â”‚   <script src="widget.js"    â”‚
                        â”‚    data-company-id="abc">    â”‚
                        â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
                                   â”‚ embeds
                                   â–¼
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚                     WIDGET APP (React/Vite)                   â”‚
â”‚  - Chat UI                                                    â”‚
â”‚  - Conversation state                                         â”‚
â”‚  - Real-time message streaming                                â”‚
â”‚  - Ticket confirmation display                                â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
                           â”‚ REST + WebSocket
                           â–¼
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚                      BACKEND API (Express)                    â”‚
â”‚                                                               â”‚
â”‚  â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”   â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”   â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”  â”‚
â”‚  â”‚ KLEO (AI)   â”‚   â”‚ Ticket Svc   â”‚   â”‚  Email Svc       â”‚  â”‚
â”‚  â”‚             â”‚   â”‚              â”‚   â”‚                  â”‚  â”‚
â”‚  â”‚ - Intent    â”‚   â”‚ - Create     â”‚   â”‚ - Route to owner â”‚  â”‚
â”‚  â”‚ - RAG       â”‚   â”‚ - Update     â”‚   â”‚ - CC manager     â”‚  â”‚
â”‚  â”‚ - Sentiment â”‚   â”‚ - Assign     â”‚   â”‚ - Digest emails  â”‚  â”‚
â”‚  â”‚ - Confidenceâ”‚   â”‚ - Status     â”‚   â”‚                  â”‚  â”‚
â”‚  â”‚ - Handoff   â”‚   â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜   â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜  â”‚
â”‚  â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜                                             â”‚
â”‚                                                               â”‚
â”‚  â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”   â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”   â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”  â”‚
â”‚  â”‚ Webhook Svc â”‚   â”‚ Health Score â”‚   â”‚ RBAC Middleware  â”‚  â”‚
â”‚  â”‚             â”‚   â”‚ Calculator   â”‚   â”‚                  â”‚  â”‚
â”‚  â”‚ - Event     â”‚   â”‚              â”‚   â”‚ - Admin          â”‚  â”‚
â”‚  â”‚   dispatch  â”‚   â”‚ - Usage      â”‚   â”‚ - Manager        â”‚  â”‚
â”‚  â”‚ - Retry     â”‚   â”‚ - Sentiment  â”‚   â”‚ - Agent          â”‚  â”‚
â”‚  â”‚   logic     â”‚   â”‚ - Tickets    â”‚   â”‚                  â”‚  â”‚
â”‚  â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜   â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜   â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜  â”‚
â”‚                                                               â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
                           â”‚
              â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”´â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
              â–¼                         â–¼
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”     â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚   PostgreSQL + pgvectorâ”‚  â”‚    Redis                 â”‚
â”‚                     â”‚     â”‚                          â”‚
â”‚ - companies         â”‚     â”‚ - Session cache          â”‚
â”‚ - users (agents)    â”‚     â”‚ - Rate limiting          â”‚
â”‚ - conversations     â”‚     â”‚ - BullMQ job queue       â”‚
â”‚ - messages          â”‚     â”‚   (emails, webhooks)     â”‚
â”‚ - tickets           â”‚     â”‚                          â”‚
â”‚ - kb_documents      â”‚     â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
â”‚ - kb_embeddings     â”‚
â”‚ - routing_rules     â”‚
â”‚ - escalation_rules  â”‚
â”‚ - canned_responses  â”‚
â”‚ - webhook_configs   â”‚
â”‚ - audit_logs        â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜

              â–²
              â”‚ also connects to
              â–¼
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚                  DASHBOARD APP (Next.js)                      â”‚
â”‚                                                               â”‚
â”‚  - Conversations view (live)                                  â”‚
â”‚  - Ticket board (Kanban / list)                               â”‚
â”‚  - Knowledge Base manager                                     â”‚
â”‚  - Routing configuration                                      â”‚
â”‚  - Escalation rules builder                                   â”‚
â”‚  - Client profiles + health scores                            â”‚
â”‚  - Team management + RBAC                                     â”‚
â”‚  - Analytics + reports                                        â”‚
â”‚  - Canned responses library                                   â”‚
â”‚  - Internal ticket comments + @mentions                       â”‚
â”‚  - KLEO (AI agent) settings + confidence logs                        â”‚
â”‚  - Webhook configuration + event log                          â”‚
â”‚  - Onboarding checklist                                       â”‚
â”‚  - Audit log                                                  â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
```

---

## Database Schema

### Core Tables

```sql
-- Multi-tenant: every row tied to a company
companies
  id, name, industry, tone, business_hours, 
  support_languages, widget_key, created_at

users (agents/admins)
  id, company_id, email, name, role (admin|manager|agent),
  is_active, created_at

clients (end users talking to the AI)
  id, company_id, external_id, name, email,
  plan_type, account_value, health_score,
  tags (jsonb), created_at

conversations
  id, company_id, client_id, status (active|resolved|handed_off),
  sentiment (positive|neutral|negative|frustrated),
  started_at, ended_at, agent_id (null if AI only)

messages
  id, conversation_id, role (ai|client|agent),
  content, confidence_score, kb_article_ids (jsonb),
  created_at

tickets
  id, company_id, conversation_id, client_id,
  issue_type, title, description,
  status (open|in_progress|awaiting_client|resolved|closed),
  importance (critical|high|medium|low),
  assigned_to (user_id), reference_number,
  raised_at, resolved_at, sla_hours, sla_breached_at

ticket_comments (internal only)
  id, ticket_id, user_id, content,
  mentioned_user_ids (jsonb), created_at

routing_rules
  id, company_id, issue_type, primary_email,
  cc_emails (jsonb), sla_hours, is_active

escalation_rules
  id, company_id, trigger_type (keyword|plan|frequency|sentiment),
  trigger_value, importance_override, action (jsonb),
  is_active

kb_documents
  id, company_id, title, content, source_type (pdf|url|text),
  category, created_at, updated_at

kb_embeddings
  id, document_id, chunk_text, embedding (vector),
  chunk_index

canned_responses
  id, company_id, title, content,
  issue_type, created_by, created_at

webhook_configs
  id, company_id, url, events (jsonb),
  secret, is_active, created_at

webhook_events
  id, company_id, event_type, payload (jsonb),
  status (pending|sent|failed), attempts,
  created_at, last_attempted_at

audit_logs
  id, company_id, user_id, action,
  resource_type, resource_id,
  metadata (jsonb), created_at
```

---

## KLEO â€” AI Agent Flow

```
Client sends message to KLEO
        â”‚
        â–¼
Load company context (KB, routing rules, escalation rules, client profile)
        â”‚
        â–¼
Intent Detection
  â†’ What is the client asking?
  â†’ Is this a churn signal? â†’ Yes â†’ Critical escalation path
  â†’ Is this sensitive (legal, billing)? â†’ Yes â†’ Skip AI resolution
        â”‚
        â–¼
Knowledge Base Retrieval (RAG)
  â†’ Semantic search over kb_embeddings
  â†’ Retrieve top N relevant chunks
  â†’ Generate answer with confidence score
        â”‚
        â”œâ”€â”€â”€ Confidence HIGH (>0.8) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
        â”‚                                                          â”‚
        â”œâ”€â”€â”€ Confidence MEDIUM (0.5â€“0.8) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”         â”‚
        â”‚                                               â”‚         â”‚
        â””â”€â”€â”€ Confidence LOW (<0.5) â”€â”€â”€â”€â”€â”               â”‚         â”‚
                                        â–¼               â–¼         â–¼
                                  Raise Ticket    Soft disclaimer  Answer directly
                                  immediately     + offer ticket   "Did this help?"
                                        â”‚               â”‚              â”‚
                                        â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜         Yes â†’ close
                                                â”‚                  No  â†’ raise ticket
                                                â–¼
                              Classify issue type using routing rules
                                                â”‚
                                                â–¼
                              Assign importance level
                              (escalation rules + plan type + sentiment)
                                                â”‚
                                                â–¼
                              Generate ticket reference number
                                                â”‚
                              â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”´â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
                              â–¼                                       â–¼
                    Send email via Resend               Log ticket in DB
                    To: issue_type owner                Update dashboard (WebSocket)
                    CC: configured recipients           Notify assigned agent
                              â”‚
                              â–¼
                    Tell client: ticket ID + expected response time
```

---

## Feature Breakdown by Module

### 1. KLEO â€” AI Chat Agent
- Multi-turn conversation with full session memory
- Intent detection (issue type classification)
- RAG-based knowledge base retrieval using pgvector
- Confidence scoring on every response
- Sentiment detection (positive / neutral / frustrated / angry)
- Churn signal detection (keyword + behavioral triggers)
- Automatic ticket raising with structured data
- Human handoff â€” AI steps back, agent takes over in same window
- Post-resolution feedback (thumbs up/down + optional comment)
- Multilingual detection and response
- Guardrails â€” AI never fabricates, never promises, says "I don't know" honestly

### 2. Ticket System
- Auto-created from AI conversations
- Status: Open â†’ In Progress â†’ Awaiting Client â†’ Resolved â†’ Closed
- Importance: Critical ðŸ”´ / High ðŸŸ  / Medium ðŸŸ¡ / Low ðŸŸ¢
- SLA countdown timer per ticket
- Full conversation transcript attached
- Internal comments with @mentions (hidden from client)
- Canned response insertion for agents
- Email reply from within dashboard
- Ticket history per client

### 3. Routing Configuration
- Issue type table (Technical, Billing, Legal, Onboarding, Feature, Access, Other)
- Per issue type: primary email, CC emails, SLA hours
- Enable/disable issue types
- Custom issue types (company can add their own)

### 4. Escalation Rules
- Trigger types: keyword match, client plan type, issue frequency, sentiment score
- Importance override per rule
- Action config: email override, CC override, ping specific user
- Special churn rule: hardcoded Critical + direct email to CS lead

### 5. Knowledge Base Manager
- Upload PDFs, paste URLs, write directly
- Organize by category
- View which articles the AI used most
- Knowledge Gap report â€” articles where AI failed and raised a ticket

### 6. Canned Responses
- Pre-written reply templates
- Organized by issue type
- One-click insert in ticket reply or live chat takeover
- Editable before sending
- Any agent can create; managers/admins can manage the library

### 7. Internal Ticket Comments
- Threaded comments per ticket
- @mention teammates
- Hidden from client completely
- Related ticket linking

### 8. Onboarding Checklist
- Step-by-step wizard on first login
- Progress tracker visible in dashboard header until complete
- Steps: Company Profile â†’ Knowledge Base â†’ Routing Config â†’ Team Invite â†’ Test Chat â†’ Go Live
- Can't mark as live until minimum required steps done

### 9. AI Confidence Score
- Every AI message has an internal confidence value (0.0â€“1.0)
- Low confidence triggers soft disclaimer in response
- Dashboard shows Confidence Log per conversation
- Knowledge Gaps report aggregates low-confidence topics by frequency
- Helps companies know exactly what to add to their knowledge base

### 10. Webhook & Event System
- Events fired: `ticket.created`, `ticket.updated`, `ticket.resolved`, `conversation.started`, `churn.detected`, `health_score.changed`, `sla.breached`
- Company configures webhook URL + selects which events to subscribe to
- Signed payloads (HMAC secret per company)
- Retry logic with exponential backoff (via BullMQ)
- Event log in dashboard â€” shows every event, payload, status (sent/failed)

### 11. Role-Based Access Control (RBAC)

| Permission | Admin | Manager | Agent |
|---|---|---|---|
| View all conversations | âœ… | âœ… | Own clients only |
| Take over conversation | âœ… | âœ… | âœ… |
| View all tickets | âœ… | âœ… | Assigned only |
| Close / resolve tickets | âœ… | âœ… | âœ… |
| Edit routing config | âœ… | âœ… | âŒ |
| Edit escalation rules | âœ… | âœ… | âŒ |
| Manage knowledge base | âœ… | âœ… | âŒ |
| Manage canned responses | âœ… | âœ… | âŒ |
| View analytics | âœ… | âœ… | Limited |
| Invite team members | âœ… | âœ… | âŒ |
| Configure webhooks | âœ… | âŒ | âŒ |
| View audit log | âœ… | âœ… | âŒ |
| Change KLEO / AI settings | âœ… | âœ… | âŒ |
| Manage own profile | âœ… | âœ… | âœ… |

### 12. Analytics Dashboard
- Total conversations this period
- Tickets raised vs resolved
- AI resolution rate (% resolved without ticket)
- Average confidence score trend
- Most common issue types (bar chart)
- Client health score distribution
- Agent performance (tickets assigned, resolved, avg response time)
- Knowledge gap report (most-failed topics)
- Webhook delivery success rate

### 13. Audit Log
- Every action logged: who, what, when, on which resource
- Filterable by user, action type, date range
- Non-deletable (append-only)
- Covers: config changes, ticket status changes, role changes, KB edits, webhook config changes

---

## Real-Time Architecture

All live updates use **Socket.io** with company-scoped rooms:

```
Company room: company:{company_id}
  â†’ New conversation started
  â†’ New message in conversation
  â†’ Ticket raised
  â†’ Ticket status changed
  â†’ Churn signal detected
  â†’ Agent assigned to ticket

Ticket room: ticket:{ticket_id}
  â†’ New internal comment
  â†’ Status update
  â†’ New message from client

Conversation room: conversation:{conversation_id}
  â†’ AI response streamed token by token
  â†’ Agent takeover event
  â†’ Sentiment change
```

Dashboard subscribes to the company room. Individual ticket/conversation views subscribe to their specific rooms.

---

## Email Architecture

All emails sent via **Resend** using pre-built templates:

| Email | Trigger | To | CC |
|---|---|---|---|
| New Ticket | Ticket raised | Issue type owner | Configured CCs |
| Ticket Assigned | Agent assigned | Assigned agent | â€” |
| Ticket Resolved | Status â†’ Resolved | Client | â€” |
| Churn Alert | Churn signal detected | CS Lead | Manager |
| Daily Digest | Scheduled (daily) | Manager | Admin |
| Ticket Update | Status change | Client (optional) | â€” |

Email templates are stored in `/backend/src/services/email/templates/` and can be customized per company in a future version.

---

## Phased Build Plan

### Phase 1 â€” Core Chat + Ticketing
- Widget app (basic chat UI)
- Backend AI agent (intent detection, KB retrieval, confidence scoring)
- Ticket creation + email routing
- Basic dashboard (conversations list, ticket board)
- Routing configuration
- PostgreSQL + pgvector setup

### Phase 2 â€” Dashboard Features
- Onboarding checklist wizard
- Canned responses
- Internal ticket comments + @mentions
- RBAC implementation
- AI confidence log + knowledge gaps report
- Real-time updates via Socket.io
- Sentiment + health score display

### Phase 3 â€” Advanced Features
- Webhook system + event log
- Full analytics dashboard
- Escalation rules builder
- Audit log
- Multilingual support
- Human handoff (CSM takeover)
- Post-resolution feedback

---

## Environment Variables

```env
# Backend
DATABASE_URL=
REDIS_URL=
OPENAI_API_KEY=
RESEND_API_KEY=
JWT_SECRET=
WIDGET_CORS_ORIGINS=

# Dashboard (Next.js)
NEXTAUTH_SECRET=
NEXTAUTH_URL=
NEXT_PUBLIC_API_URL=
NEXT_PUBLIC_WS_URL=

# Widget (Vite)
VITE_API_URL=
VITE_WS_URL=
```

---

## Key Design Decisions

**Monorepo over separate repos** â€” shared types, shared UI components, single CI/CD pipeline, easier to keep frontend and backend in sync.

**pgvector over a separate vector DB** â€” keeps the stack simple for a demo/V1. No need for Pinecone or Weaviate when Postgres can handle it with the pgvector extension.

**BullMQ for async tasks** â€” email sending and webhook dispatch should never block the API response. The job queue handles retries, failures, and scheduling without adding latency to the user-facing flow.

**Socket.io for real-time** â€” simpler than raw WebSockets for a multi-tenant dashboard. Room-based architecture naturally maps to the company-scoped data model.

**Resend for email** â€” developer-friendly, great deliverability, easy template system, generous free tier for demo purposes.

**Confidence score as a first-class concept** â€” this is what makes the AI trustworthy. Instead of silently failing, it surfaces uncertainty both to the client and to the company, which drives knowledge base improvement over time.