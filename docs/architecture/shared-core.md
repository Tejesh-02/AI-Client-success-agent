# Shared Core Architecture

## Shared Services
- Tenant resolver (`company_slug` -> `company_id`).
- Conversation service for customer and internal channels.
- Ticket service with 5-level ITSM severity.
- LLM orchestration through backend only (`groq` default, provider configurable).
- Email notification service with notification logs.
- Audit logger.

## API Segmentation
- Public: `/public/v1/*`
- Internal: `/internal/v1/*`

## Data Model Extensions
- `companies.slug`, support and emergency mail settings.
- `customer_sessions` for customer token lifecycle.
- `ticket_notifications` for notification attempts.
- AI metadata columns on `messages`.

## Isolation Rules
- Every query scoped by `company_id`.
- No Socket.io dependency; frontend consumes REST APIs.

## Operational Defaults
- Groq model default: `llama-3.3-70b-versatile`.
- Sessions expire after 24 hours.
- Critical and emergency tickets trigger emergency CC routing.
