import type { PublicChatMessageRequest, PublicSessionRequest, PublicSessionResponse } from "@clientpulse/types";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:4000";

interface ApiMessage {
  id: string;
  role: "ai" | "client" | "agent";
  content: string;
  createdAt: string;
}

export interface SendMessageResponse {
  clientMessageId: string;
  clientMessageCreatedAt: string;
  messageId: string;
  aiResponseCreatedAt: string;
  aiResponse: string;
  confidence: number;
  ticket: {
    id: string;
    referenceNumber: string;
    title: string;
    severity: string;
  } | null;
}

const parseJson = async <T>(response: Response): Promise<T> => {
  if (!response.ok) {
    const payload = await response.json().catch(() => ({ error: "Unknown API error" }));
    throw new Error(payload.error ?? `Request failed with ${response.status}`);
  }
  return (await response.json()) as T;
};

export const createCustomerSession = async (
  companySlug: string,
  payload: PublicSessionRequest
): Promise<PublicSessionResponse> => {
  const response = await fetch(`${API_URL}/public/v1/tenants/${companySlug}/session`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

  return parseJson<PublicSessionResponse>(response);
};

export const sendCustomerMessage = async (
  conversationId: string,
  payload: PublicChatMessageRequest
): Promise<SendMessageResponse> => {
  const response = await fetch(`${API_URL}/public/v1/conversations/${conversationId}/messages`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

  return parseJson<SendMessageResponse>(response);
};

export const getTranscript = async (conversationId: string, sessionToken: string): Promise<ApiMessage[]> => {
  const response = await fetch(
    `${API_URL}/public/v1/conversations/${conversationId}/messages?sessionToken=${encodeURIComponent(sessionToken)}`
  );

  const payload = await parseJson<{ items: ApiMessage[] }>(response);
  return payload.items;
};

export const submitFeedback = async (
  conversationId: string,
  sessionToken: string,
  rating: "up" | "down",
  comment?: string
): Promise<void> => {
  const response = await fetch(`${API_URL}/public/v1/conversations/${conversationId}/feedback`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sessionToken, rating, comment: comment ?? undefined })
  });
  await parseJson<{ ok: boolean }>(response);
};
