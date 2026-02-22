import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { createCustomerSession, getTranscript, sendCustomerMessage, submitFeedback } from "../lib/api.ts";

interface LocalMessage {
  id: string;
  role: "client" | "ai";
  content: string;
  createdAt: string;
}

const AGENT_NAME = "Support";
const formatTime = (iso: string) => {
  const d = new Date(iso);
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  return isToday ? d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : d.toLocaleString([], { dateStyle: "short", timeStyle: "short" });
};

export const ChatPage = () => {
  const { companySlug = "" } = useParams();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [input, setInput] = useState("");
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [companyDisplayName, setCompanyDisplayName] = useState("");
  const [messages, setMessages] = useState<LocalMessage[]>([]);
  const [ticketNotice, setTicketNotice] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [feedbackSubmitted, setFeedbackSubmitted] = useState(false);
  const [feedbackComment, setFeedbackComment] = useState("");
  const [feedbackSending, setFeedbackSending] = useState(false);
  const [transcriptLoading, setTranscriptLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messageInputRef = useRef<HTMLInputElement>(null);

  const canSubmitPreChat = useMemo(
    () => name.trim().length > 0 && email.trim().length > 3,
    [name, email]
  );

  const refetchTranscript = useCallback(() => {
    if (!sessionToken || !conversationId) return;
    setError(null);
    setTranscriptLoading(true);
    getTranscript(conversationId, sessionToken)
      .then((items) => {
        setMessages(
          items
            .filter((item): item is { id: string; role: "client" | "ai"; content: string; createdAt: string } => item.role === "client" || item.role === "ai")
            .map((item) => ({ id: item.id, role: item.role, content: item.content, createdAt: item.createdAt }))
        );
      })
      .catch((apiError: Error) => setError(apiError.message))
      .finally(() => setTranscriptLoading(false));
  }, [sessionToken, conversationId]);

  useEffect(() => {
    if (!sessionToken || !conversationId) return;
    setTranscriptLoading(true);
    getTranscript(conversationId, sessionToken)
      .then((items) => {
        setMessages(
          items
            .filter((item): item is { id: string; role: "client" | "ai"; content: string; createdAt: string } => item.role === "client" || item.role === "ai")
            .map((item) => ({ id: item.id, role: item.role, content: item.content, createdAt: item.createdAt }))
        );
      })
      .catch((apiError: Error) => setError(apiError.message))
      .finally(() => setTranscriptLoading(false));
  }, [sessionToken, conversationId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, submitting]);

  const onStartChat = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const session = await createCustomerSession(companySlug, { name, email });
      setSessionToken(session.sessionToken);
      setConversationId(session.conversationId);
      setCompanyDisplayName(session.companyDisplayName);
      setTicketNotice(null);
      setTimeout(() => messageInputRef.current?.focus(), 0);
    } catch (apiError) {
      setError(apiError instanceof Error ? apiError.message : "Failed to start chat session");
    } finally {
      setSubmitting(false);
    }
  };

  const onSend = async () => {
    if (!sessionToken || !conversationId || !input.trim()) return;
    const content = input.trim();
    const now = new Date().toISOString();
    const outgoing: LocalMessage = { id: `temp-${Date.now()}`, role: "client", content, createdAt: now };
    setInput("");
    setMessages((current) => [...current, outgoing]);
    setSubmitting(true);
    setError(null);
    try {
      const response = await sendCustomerMessage(conversationId, { sessionToken, content });
      setMessages((current) => [
        ...current,
        { id: response.messageId, role: "ai", content: response.aiResponse, createdAt: now }
      ]);
      if (response.ticket) {
        const t = response.ticket;
        const titlePart = t.title ? (t.title.length > 50 ? `${t.title.slice(0, 50)}…` : t.title) : "";
        setTicketNotice(titlePart ? `Ticket ${t.referenceNumber} created: ${titlePart}` : `Ticket ${t.referenceNumber} created (${t.severity}).`);
      } else {
        setTicketNotice(null);
      }
    } catch (apiError) {
      setError(apiError instanceof Error ? apiError.message : "Failed to send message");
    } finally {
      setSubmitting(false);
    }
  };

  const lastMessageIsAi = messages.length > 0 && messages[messages.length - 1].role === "ai";
  const showFeedbackPrompt = messages.length >= 2 && lastMessageIsAi && !feedbackSubmitted;

  const onFeedback = async (rating: "up" | "down") => {
    if (!sessionToken || !conversationId) return;
    setFeedbackSending(true);
    try {
      await submitFeedback(conversationId, sessionToken, rating, feedbackComment.trim() || undefined);
      setFeedbackSubmitted(true);
    } catch {
      setError("Failed to submit feedback");
    } finally {
      setFeedbackSending(false);
    }
  };

  const suggestedQuestions = ["I have a billing question", "Something isn't working", "I need help with my account"];

  if (!sessionToken) {
    return (
      <div className="cp-chat" data-company-slug={companySlug}>
        <div className="cp-chat-container">
          <section className="cp-prechat">
            <div className="cp-prechat-header">
              <h1 className="cp-prechat-title">{companyDisplayName || "Support"}</h1>
              <p className="cp-prechat-welcome">We're here to help. Start by telling us who you are.</p>
            </div>
            <form
              className="cp-prechat-form"
              onSubmit={(e) => {
                e.preventDefault();
                if (canSubmitPreChat && !submitting) onStartChat();
              }}
            >
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your full name"
                aria-label="Name"
                className="cp-input"
              />
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
                aria-label="Email"
                type="email"
                className="cp-input"
              />
              <button type="submit" disabled={!canSubmitPreChat || submitting} className="cp-btn cp-btn-primary">
                {submitting ? "Starting…" : "Start chat"}
              </button>
            </form>
            {error ? (
              <div role="alert" className="cp-error-wrap">
                <p className="cp-error">{error}</p>
                <button type="button" onClick={() => { setError(null); onStartChat(); }} className="cp-btn cp-btn-primary" style={{ marginTop: "0.5rem" }}>
                  Try again
                </button>
              </div>
            ) : null}
          </section>
        </div>
      </div>
    );
  }

  return (
    <div className="cp-chat" data-company-slug={companySlug}>
      <div className="cp-chat-window">
        <header className="cp-chat-header">
          <div className="cp-chat-header-avatar" aria-hidden />
          <div className="cp-chat-header-text">
            <span className="cp-chat-header-name">{companyDisplayName || AGENT_NAME}</span>
            <span className="cp-chat-header-status">Here to help · Typically replies in minutes</span>
          </div>
        </header>

        <div className="cp-chat-body">
          <div className="cp-messages">
            {transcriptLoading && messages.length === 0 ? (
              <div className="cp-empty-state" aria-live="polite">
                <p className="cp-empty-state-title">Loading conversation…</p>
              </div>
            ) : messages.length === 0 && error ? (
              <div className="cp-empty-state" role="alert">
                <p className="cp-error">{error}</p>
                <button type="button" onClick={refetchTranscript} className="cp-btn cp-btn-primary" style={{ marginTop: "0.5rem" }}>
                  Try again
                </button>
              </div>
            ) : messages.length === 0 ? (
              <div className="cp-empty-state">
                <p className="cp-empty-state-title">How can we help?</p>
                <p className="cp-empty-state-sub">Send a message below or try one of these:</p>
                <div className="cp-suggestions">
                  {suggestedQuestions.map((q) => (
                    <button key={q} type="button" className="cp-suggestion-chip" onClick={() => setInput(q)}>
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
            {messages.map((message) => (
              <div key={message.id} className={`cp-bubble-wrap cp-bubble-wrap--${message.role}`}>
                {message.role === "ai" && <div className="cp-bubble-avatar cp-bubble-avatar--agent" aria-hidden />}
                <div className={`cp-bubble cp-bubble--${message.role}`}>
                  <span className="cp-bubble-content">{message.content}</span>
                  <span className="cp-bubble-time">{formatTime(message.createdAt)}</span>
                </div>
                {message.role === "client" && <div className="cp-bubble-avatar cp-bubble-avatar--user">{name.trim().slice(0, 2).toUpperCase() || "You"}</div>}
              </div>
            ))}
            {submitting && (
              <div className="cp-bubble-wrap cp-bubble-wrap--ai" role="status" aria-live="polite" aria-label="Support is typing">
                <div className="cp-bubble-avatar cp-bubble-avatar--agent" aria-hidden />
                <div className="cp-bubble cp-bubble--typing">
                  <span className="cp-typing-dots">
                    <span /><span /><span />
                  </span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {ticketNotice && (
            <div className="cp-ticket-notice" role="status">
              <span className="cp-ticket-notice-icon" aria-hidden>✓</span>
              {ticketNotice} We'll follow up.
            </div>
          )}

          {showFeedbackPrompt && (
            <div className="cp-feedback">
              <span className="cp-feedback-label">Was this helpful?</span>
              <div className="cp-feedback-actions">
                <button type="button" onClick={() => onFeedback("up")} disabled={feedbackSending} className="cp-feedback-btn" aria-label="Yes">
                  👍
                </button>
                <button type="button" onClick={() => onFeedback("down")} disabled={feedbackSending} className="cp-feedback-btn" aria-label="No">
                  👎
                </button>
                <textarea
                  value={feedbackComment}
                  onChange={(e) => setFeedbackComment(e.target.value)}
                  placeholder="Optional comment"
                  className="cp-feedback-comment"
                  aria-label="Optional comment"
                  rows={2}
                />
              </div>
            </div>
          )}
          {feedbackSubmitted && <p className="cp-feedback-thanks">Thank you for your feedback.</p>}

          <div className="cp-input-area">
            <input
              ref={messageInputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Type your message…"
              onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && onSend()}
              className="cp-input cp-input--message"
              aria-label="Message"
            />
            <button type="button" disabled={submitting || !input.trim()} onClick={onSend} className="cp-btn cp-btn-send" aria-label="Send">
              {submitting ? "…" : "Send"}
            </button>
          </div>
        </div>
        {error && messages.length > 0 ? (
          <div role="alert" className="cp-error-inline-wrap">
            <p className="cp-error cp-error-inline">{error}</p>
            <button type="button" onClick={() => { setError(null); messageInputRef.current?.focus(); }} className="cp-btn cp-btn-primary" style={{ marginTop: "0.5rem" }}>
              Try again
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
};
