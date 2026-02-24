# ClientPulse - AI Client Success Agent (Architecture Documentation)

## Project Overview

ClientPulse is an AI-first Client Success Management SaaS platform. Companies onboard onto the platform, configure the AI Client Success Agent with their knowledge base and routing rules, and embed the chat widget on their own product. Their clients interact with the AI agent, which resolves issues, raises tickets, and routes them to the right team member — all visible in real time on the ClientPulse dashboard.

---

## Repository Structure

This is a **monorepo** — one GitHub repository, two separate frontend apps, one shared backend, and shared packages.

```
clientpulse/
├── apps/
│   ├── internal-dashboard/         # Internal dashboard (Next.js) — for CS teams
│   └── customer-chat/             # Chat widget (React + Vite) — client-facing embed
│
├── packages/
│   └── types/                      # Shared TypeScript types across apps
│
├── backend/                        # Shared API core
│   ├── src/
│   │   ├── api/                    # REST API route handlers
│   │   │   ├── internal/           # Internal API endpoints
│   │   │   └── public/             # Public API endpoints
│   │   ├── services/               # Business logic services
│   │   ├── middleware/             # Express middleware
│   │   ├── db/                     # Database configuration
│   │   └── types/                  # Backend-specific types
│   ├── db/                         # Database migrations
│   └── scripts/                    # Utility scripts
│
├── docs/
│   └── architecture/               # Split architecture docs
│
├── README.md
├── package.json                    # Root monorepo config
└── tsconfig.base.json              # Shared TypeScript configuration
```

---

## Why Two Separate Apps?

| | Dashboard App | Customer Chat App |
|---|---|---|
| **Who uses it** | CS team (internal) | End clients (public) |
| **Auth required** | Yes — login with roles | No — identified by company ID |
| **Bundle size** | Can be heavy | Must be lightweight (<100kb) |
| **Framework** | Next.js (SSR, SEO, auth) | React + Vite (fast, embeddable) |
| **Deployment** | dashboard.clientpulse.io | cdn.clientpulse.io/widget.js |
| **Real-time needs** | Full dashboard updates | Single conversation stream |

They share the same backend API and the same database. The `packages/` folder holds shared types so there's no duplication.

---

## Tech Stack

### Frontend — Internal Dashboard
- **Framework:** Next.js 14 (App Router)
- **Styling:** Tailwind CSS
- **State Management:** React built-in state
- **Data Fetching:** Native fetch API
- **Auth:** Custom JWT-based authentication

### Frontend — Customer Chat Widget
- **Framework:** React 18 + Vite
- **Styling:** Tailwind CSS (scoped to avoid conflicts with host site)
- **State:** React Context + useReducer
- **Routing:** React Router DOM
- **Output:** Single embeddable JS bundle

### Backend
- **Runtime:** Node.js + TypeScript
- **Framework:** Express.js
- **Database:** PostgreSQL (via Supabase)
- **ORM:** Direct PostgreSQL client with Drizzle ORM for migrations
- **Auth:** JWT + bcrypt for password hashing
- **Validation:** Zod schemas
- **Logging:** Pino logger
- **Rate Limiting:** Express rate limiter

### Database
- **Primary:** PostgreSQL (via Supabase)
- **Migrations:** Drizzle ORM migration files
- **Schema:** Multi-tenant architecture with company_id isolation

---

## System Architecture Diagram

```
                        ┌─────────────────────────────┐
                        │      Company's Website      │
                        │   <script src="widget.js"  │
                        │    data-company-id="abc">   │
                        └─────────────────┬───────────┘
                                      │ embeds
                                      ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                    CUSTOMER CHAT APP (React/Vite)                      │
│  - Chat UI                                                              │
│  - Conversation state                                                   │
│  - Real-time message streaming                                          │
│  - Ticket confirmation display                                         │
└─────────────────────────┬───────────────────────────────────────────────┘
                          │ REST API
                          ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                      BACKEND API (Express)                              │
│                                                                         │
│  ┌─────────────────┐   ┌─────────────────┐   ┌─────────────────────┐  │
│  │ Conversation    │   │ Ticket Service  │   │ Email Service       │  │
│  │ Service         │   │                 │   │                     │  │
│  │ - Sessions      │   │ - Create        │   │ - Route to owner    │  │
│  │ - Messages      │   │ - Update        │   │ - CC manager        │  │
│  │ - AI Integration│   │ - Assign        │   │ - Digest emails     │  │
│  └─────────────────┘   └─────────────────┘   └─────────────────────┘  │
│                                                                         │
│  ┌─────────────────┐   ┌─────────────────┐   ┌─────────────────────┐  │
│  │ Auth Middleware │   │ Audit Service   │   │ RBAC Middleware     │  │
│  │                 │   │                 │   │                     │  │
│  │ - JWT validation│   │ - Log actions   │   │ - Admin             │  │
│  │ - Password hash │   │ - Track changes │   │ - Manager           │  │
│  │                 │   │                 │   │ - Agent             │  │
│  └─────────────────┘   └─────────────────┘   └─────────────────────┘  │
│                                                                         │
└─────────────────────────┬───────────────────────────────────────────────┘
                          │
              ┌───────────┴───────────┐
              ▼                       ▼
┌─────────────────────┐   ┌─────────────────────┐
│   PostgreSQL        │   │    Supabase         │
│                     │   │                     │
│ - companies         │   │ - Auth provider     │
│ - users (agents)    │   │ - Real-time         │
│ - conversations     │   │ - Storage           │
│ - messages          │   │                     │
│ - tickets           │   └─────────────────────┘
│ - kb_documents      │
│ - routing_rules     │
│ - escalation_rules  │
│ - canned_responses  │
│ - webhook_configs   │
│ - audit_logs        │
└─────────────────────┘

              ▲
              │ also connects to
              ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                INTERNAL DASHBOARD APP (Next.js)                        │
│                                                                         │
│  - Conversations view (live)                                           │
│  - Ticket board (Kanban / list)                                        │
│  - Knowledge Base manager                                              │
│  - Routing configuration                                               │
│  - Escalation rules builder                                            │
│  - Client profiles + health scores                                     │
│  - Team management + RBAC                                              │
│  - Analytics + reports                                                 │
│  - Canned responses library                                            │
│  - Internal ticket comments + @mentions                                │
│  - AI agent settings + confidence logs                                 │
│  - Webhook configuration + event log                                   │
│  - Onboarding checklist                                                │
│  - Audit log                                                           │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Database Schema

### Core Tables

```sql
-- Multi-tenant: every row tied to a company
companies
  id, name, slug, industry, support_email, emergency_email,
  widget_key, created_at, updated_at

users (agents/admins)
  id, company_id, email, password_hash, name, role (admin|manager|agent),
  is_active, created_at, updated_at

customer_sessions
  id, company_id, token, expires_at, created_at

conversations
  id, company_id, session_id, status (active|resolved),
  started_at, ended_at, created_at, updated_at

messages
  id, conversation_id, role (ai|customer|agent),
  content, ai_confidence, ai_model, ai_provider,
  created_at, updated_at

tickets
  id, company_id, conversation_id, customer_session_id,
  issue_type_id, title, description,
  status (open|in_progress|awaiting_customer|resolved|closed),
  severity (critical|high|medium|low),
  assigned_to, reference_number,
  created_at, updated_at, sla_due_at, resolved_at

ticket_notifications
  id, ticket_id, to_email, cc_emails, status (pending|sent|failed),
  attempts, created_at, sent_at

issue_types
  id, company_id, name, description, is_active, created_at, updated_at

escalation_rules
  id, company_id, name, trigger_type, trigger_value,
  severity_override, action, is_active, created_at, updated_at

company_documents
  id, company_id, title, content, source_type, source_url,
  created_at, updated_at

canned_responses
  id, company_id, title, content, issue_type_id,
  created_by, created_at, updated_at

webhooks
  id, company_id, url, events, secret, is_active,
  created_at, updated_at

audit_logs
  id, company_id, user_id, action,
  resource_type, resource_id,
  old_values, new_values, created_at
```

---

## API Architecture

### API Segmentation
- **Public API**: `/public/v1/*` - For customer chat widget
  - Sessions management
  - Conversations and messages
  - No authentication required (identified by company_id)

- **Internal API**: `/internal/v1/*` - For internal dashboard
  - Authentication required (JWT)
  - Full CRUD operations
  - Role-based access control

### Key Services

#### Conversation Service
- Manages customer sessions and conversations
- Handles message persistence
- Integrates with AI service for responses
- Tracks conversation status and metadata

#### Ticket Service
- Creates tickets from conversations
- Manages ticket lifecycle and assignments
- Handles SLA tracking and notifications
- Integrates with email service for notifications

#### AI Service
- Integrates with LLM providers (Groq by default)
- Handles intent detection and response generation
- Manages confidence scoring
- Supports multiple AI providers

#### Email Service
- Sends ticket notifications
- Handles email routing based on issue types
- Manages notification logs and retry logic

#### Audit Service
- Logs all important actions
- Tracks changes to critical resources
- Provides audit trail for compliance

---

## Authentication & Authorization

### Internal Dashboard Authentication
- Email/password login with JWT tokens
- Role-based access control (RBAC)
- Password hashing with bcrypt
- Session management with token expiration

### Customer Chat Authentication
- No authentication required
- Identified by company_id and session token
- Session tokens expire after 24 hours

### Role-Based Access Control (RBAC)

| Permission | Admin | Manager | Agent |
|---|---|---|---|
| View all conversations | ✅ | ✅ | All conversations |
| Take over conversation | ✅ | ✅ | ✅ |
| View all tickets | ✅ | ✅ | Assigned only |
| Close / resolve tickets | ✅ | ✅ | ✅ |
| Edit routing config | ✅ | ✅ | ❌ |
| Edit escalation rules | ✅ | ✅ | ❌ |
| Manage knowledge base | ✅ | ✅ | ❌ |
| Manage canned responses | ✅ | ✅ | ❌ |
| View analytics | ✅ | ✅ | Limited |
| Invite team members | ✅ | ✅ | ❌ |
| Configure webhooks | ✅ | ❌ | ❌ |
| View audit log | ✅ | ✅ | ❌ |
| Change AI settings | ✅ | ✅ | ❌ |
| Manage own profile | ✅ | ✅ | ✅ |

---

## AI Integration

### Default AI Provider
- **Groq** with `llama-3.3-70b-versatile` model
- Configurable to support other providers
- Provider-agnostic interface through AI service

### AI Features
- Intent detection and classification
- Response generation with confidence scoring
- Context-aware conversation handling
- Knowledge base integration for accurate responses

### Confidence Scoring
- Every AI response includes a confidence score (0.0-1.0)
- Low confidence responses trigger ticket creation
- Confidence tracking for knowledge gap analysis

---

## Environment Variables

```env
# Backend
DATABASE_URL=postgresql://...
SUPABASE_URL=your-supabase-url
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
AI_PROVIDER=groq
GROQ_API_KEY=your-groq-api-key
JWT_SECRET=your-jwt-secret
PORT=3001

# Internal Dashboard (Next.js)
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXTAUTH_SECRET=your-nextauth-secret
NEXTAUTH_URL=http://localhost:3000

# Customer Chat Widget (Vite)
VITE_API_URL=http://localhost:3001
```

---

## Development Workflow

### Prerequisites
- Node.js 20+
- PostgreSQL database (Supabase recommended)
- Redis for caching (optional for development)

### Setup
1. Clone the repository
2. Install dependencies: `npm install`
3. Set up environment variables
4. Run database migrations: `npm run db:setup`
5. Start development servers:
   - Backend: `npm run dev`
   - Dashboard: `cd apps/internal-dashboard && npm run dev`
   - Widget: `cd apps/customer-chat && npm run dev`

### Scripts
- `npm run build` - Build all packages and applications
- `npm run test` - Run tests across all packages
- `npm run typecheck` - Type check all TypeScript code
- `npm run db:setup` - Run migrations and seed data
- `npm run migrate` - Run database migrations
- `npm run seed` - Seed database with initial data

---

## Key Design Decisions

**Monorepo over separate repos** — shared types, single CI/CD pipeline, easier to keep frontend and backend in sync.

**Supabase over direct PostgreSQL** — provides authentication, real-time subscriptions, and managed PostgreSQL with less operational overhead.

**Groq as default AI provider** — fast inference, cost-effective, and reliable for production use cases.

**JWT-based authentication** — stateless, scalable, and works well with microservices architecture.

**Role-based access control** — provides fine-grained permissions for different user types in the organization.

**Confidence scoring** — makes the AI more trustworthy by surfacing uncertainty both to customers and to the company.

**Multi-tenant architecture** — ensures data isolation between companies while allowing for efficient resource utilization.

---

## Future Enhancements

1. **Advanced AI Features**
   - Multi-language support
   - Sentiment analysis
   - Churn prediction
   - Custom AI model fine-tuning

2. **Enhanced Dashboard**
   - Real-time analytics
   - Advanced reporting
   - Custom dashboards
   - Mobile app

3. **Integrations**
   - Slack/Teams integration
   - CRM integration
   - Help desk software integration
   - Custom webhooks

4. **Performance & Scalability**
   - Caching layer
   - Database optimization
   - CDN for static assets
   - Horizontal scaling

5. **Security & Compliance**
   - SOC 2 compliance
   - GDPR compliance
   - Advanced security features
   - Data encryption at rest and in transit