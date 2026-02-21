import request, { type SuperTest, type Test } from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../src/app";
import { createSeedStore, makeId, sha256 } from "../src/store/inMemoryStore";

const loginAs = async (
  client: SuperTest<Test>,
  payload: { email: string; password: string; companySlug?: string }
): Promise<string> => {
  const response = await client.post("/internal/v1/auth/login").send({
    companySlug: payload.companySlug ?? "acme",
    email: payload.email,
    password: payload.password
  });

  expect(response.status).toBe(200);
  expect(response.body.token).toEqual(expect.any(String));
  return response.body.token as string;
};

describe("public session APIs", () => {
  it("rejects invalid pre-chat payload", async () => {
    const { app } = createApp(createSeedStore());

    const response = await request(app).post("/public/v1/tenants/acme/session").send({
      name: "Alice",
      email: "not-an-email"
    });

    expect(response.status).toBe(400);
  });

  it("creates customer session with valid name and email", async () => {
    const { app } = createApp(createSeedStore());

    const response = await request(app).post("/public/v1/tenants/acme/session").send({
      name: "Bob Customer",
      email: "bob@example.com"
    });

    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({
      sessionToken: expect.any(String),
      clientId: expect.any(String),
      conversationId: expect.any(String),
      companyDisplayName: "Acme Corp"
    });
  });
});

describe("public conversation APIs", () => {
  it("blocks invalid session token", async () => {
    const { app } = createApp(createSeedStore());

    const response = await request(app)
      .post("/public/v1/conversations/conversation_1/messages")
      .send({ sessionToken: "bad-token", content: "hello" });

    expect(response.status).toBe(401);
  });

  it("enforces tenant isolation across conversations", async () => {
    const store = createSeedStore();

    store.companies.push({
      id: "company_other",
      name: "OtherCo",
      slug: "other",
      supportEmail: "support@other.test",
      emergencyEmail: "emergency@other.test",
      notificationCc: [],
      isProfileComplete: true
    });

    store.clients.push({
      id: "client_other",
      companyId: "company_other",
      name: "Other Client",
      email: "other@example.com",
      createdAt: new Date().toISOString()
    });

    store.conversations.push({
      id: "conversation_other",
      companyId: "company_other",
      clientId: "client_other",
      status: "active",
      sentiment: "neutral",
      channel: "hosted_chat",
      startedAt: new Date().toISOString(),
      lastMessageAt: new Date().toISOString(),
      endedAt: null,
      agentId: null,
      prioritySnapshot: null
    });

    const { app } = createApp(store);

    const sessionResponse = await request(app).post("/public/v1/tenants/acme/session").send({
      name: "Alice",
      email: "alice@example.com"
    });

    const response = await request(app)
      .get("/public/v1/conversations/conversation_other/messages")
      .query({ sessionToken: sessionResponse.body.sessionToken });

    expect(response.status).toBe(404);
  });

  it("handles normal AI path without ticket", async () => {
    const store = createSeedStore();
    const { app } = createApp(store);

    const sessionResponse = await request(app).post("/public/v1/tenants/acme/session").send({
      name: "Alice",
      email: "alice@example.com"
    });

    const messageResponse = await request(app)
      .post(`/public/v1/conversations/${sessionResponse.body.conversationId}/messages`)
      .send({ sessionToken: sessionResponse.body.sessionToken, content: "How do I update my profile settings?" });

    expect(messageResponse.status).toBe(201);
    expect(messageResponse.body.ticket).toBeNull();
    expect(messageResponse.body.aiResponse).toEqual(expect.any(String));
  });

  it("creates emergency ticket and notification for emergency language", async () => {
    const store = createSeedStore();
    const { app, context } = createApp(store);

    const sessionResponse = await request(app).post("/public/v1/tenants/acme/session").send({
      name: "Alice",
      email: "alice@example.com"
    });

    const messageResponse = await request(app)
      .post(`/public/v1/conversations/${sessionResponse.body.conversationId}/messages`)
      .send({
        sessionToken: sessionResponse.body.sessionToken,
        content: "Production down outage and possible data loss, urgent help needed"
      });

    expect(messageResponse.status).toBe(201);
    expect(messageResponse.body.ticket).toMatchObject({
      severity: "emergency",
      referenceNumber: expect.any(String)
    });

    const emergencyTicket = context.store.tickets.find((ticket) => ticket.id === messageResponse.body.ticket.id);
    expect(emergencyTicket?.severity).toBe("emergency");

    const notification = context.store.ticketNotifications.find((item) => item.ticketId === emergencyTicket?.id);
    expect(notification).toBeDefined();
    expect(notification?.cc).toContain("emergency@acme.test");
  });
});

describe("internal auth + APIs", () => {
  it("logs in with email and password", async () => {
    const { app } = createApp(createSeedStore());

    const response = await request(app).post("/internal/v1/auth/login").send({
      companySlug: "acme",
      email: "manager@acme.test",
      password: "password123"
    });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      token: expect.any(String),
      user: {
        email: "manager@acme.test",
        role: "manager"
      }
    });
  });

  it("lists only assigned tickets for agent role", async () => {
    const store = createSeedStore();
    store.tickets.push({
      id: makeId("ticket"),
      companyId: "company_acme",
      conversationId: "conversation_1",
      clientId: "client_1",
      title: "Unassigned",
      description: "Another issue",
      status: "open",
      severity: "low",
      assignedTo: null,
      referenceNumber: "CP-9191",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    const { app } = createApp(store);
    const client = request(app);
    const token = await loginAs(client, {
      email: "agent@acme.test",
      password: "password123"
    });

    const response = await client.get("/internal/v1/tickets").set("authorization", `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.items).toHaveLength(1);
    expect(response.body.items[0].assignedTo).toBe("user_agent_1");
  });

  it("updates ticket lifecycle and persists audit log", async () => {
    const store = createSeedStore();
    const { app, context } = createApp(store);
    const client = request(app);
    const token = await loginAs(client, {
      email: "manager@acme.test",
      password: "password123"
    });

    const response = await client
      .patch("/internal/v1/tickets/ticket_seed_1")
      .set("authorization", `Bearer ${token}`)
      .send({
        status: "in_progress",
        severity: "important",
        assignedTo: "user_agent_1"
      });

    expect(response.status).toBe(200);
    expect(response.body.status).toBe("in_progress");
    expect(response.body.severity).toBe("important");

    const audit = context.store.auditLogs.find((log) => log.action === "ticket.updated");
    expect(audit).toBeDefined();
  });

  it("creates internal ticket comments", async () => {
    const { app } = createApp(createSeedStore());
    const client = request(app);
    const token = await loginAs(client, {
      email: "manager@acme.test",
      password: "password123"
    });

    const response = await client
      .post("/internal/v1/tickets/ticket_seed_1/comments")
      .set("authorization", `Bearer ${token}`)
      .send({
        content: "Please take this over",
        mentionedUserIds: ["user_agent_1"]
      });

    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({
      id: expect.any(String),
      ticketId: "ticket_seed_1",
      userId: "user_manager_1"
    });
  });
});

describe("session expiry", () => {
  it("blocks expired session token", async () => {
    const store = createSeedStore();
    store.customerSessions.push({
      id: "session_expired",
      companyId: "company_acme",
      clientId: "client_1",
      tokenHash: sha256("expired-token"),
      expiresAt: new Date(Date.now() - 60_000).toISOString(),
      ip: null,
      userAgent: null,
      createdAt: new Date().toISOString()
    });

    const { app } = createApp(store);

    const response = await request(app)
      .post("/public/v1/conversations/conversation_1/messages")
      .send({ sessionToken: "expired-token", content: "hello" });

    expect(response.status).toBe(401);
  });
});
