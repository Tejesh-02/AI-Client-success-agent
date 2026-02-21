# Customer Chat Architecture

## Scope
- Hosted customer AI chat app served on `/chat/:companySlug`.
- Required pre-chat form for `name` and `email`.
- Chat session and conversation history tied to tenant slug.

## Non-goals
- Embeddable widget delivery in v1.
- Public admin/configuration features.

## Primary Flows
1. Customer opens `/chat/:companySlug`.
2. App posts `name` and `email` to `/public/v1/tenants/:slug/session`.
3. Backend returns session token, client id, and conversation id.
4. Customer sends messages to `/public/v1/conversations/:id/messages`.
5. App reads transcript from `/public/v1/conversations/:id/messages`.

## API Contracts
- `POST /public/v1/tenants/:slug/session`
- `POST /public/v1/conversations/:conversationId/messages`
- `GET /public/v1/conversations/:conversationId/messages`

## Security Model
- Session token required for all conversation reads/writes.
- Tenant isolation enforced by company slug + session company id checks.

## Escalation
- Emergency and low-confidence paths create ticket and return ticket reference to customer.
