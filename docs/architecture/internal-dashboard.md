# Internal Dashboard Architecture

## Scope
- Internal CS operations only.
- Monitor conversations, triage tickets, assign owners, and update lifecycle.
- Enforce RBAC for `admin`, `manager`, `agent`.

## Non-goals
- Customer authentication and session creation.
- Direct LLM provider calls from frontend.

## Primary Flows
1. Internal user authenticates and receives role + company context.
2. Dashboard loads conversations from `/internal/v1/conversations`.
3. Dashboard loads tickets from `/internal/v1/tickets` with filters.
4. Ticket status, severity, and assignee updates are sent to `/internal/v1/tickets/:id`.
5. Internal comments with mentions are posted to `/internal/v1/tickets/:id/comments`.

## API Contracts
- `GET /internal/v1/conversations`
- `GET /internal/v1/tickets`
- `PATCH /internal/v1/tickets/:id`
- `POST /internal/v1/tickets/:id/comments`

## Security Model
- Internal auth uses email/password login and JWT bearer tokens.
- RBAC filtering limits visibility for `agent` role.

## Refresh Model
- Dashboard uses API polling/refresh actions (no Socket.io dependency).

## Data Dependencies
- `conversations`, `messages`, `tickets`, `ticket_comments`, `audit_logs`.
