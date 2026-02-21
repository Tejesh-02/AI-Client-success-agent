import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { createCustomerSession, getTranscript, sendCustomerMessage, submitFeedback } from "../lib/api";

interface LocalMessage {
  id: string;
  role: "client" | "ai";
  content: string;
}

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

  const canSubmitPreChat = useMemo(
    () => name.trim().length > 0 && email.trim().length > 3,
    [name, email]
  );

  useEffect(() => {
    if (!sessionToken || !conversationId) {
      return;
    }

    getTranscript(conversationId, sessionToken)
      .then((items) => {
        setMessages(
          items
            .filter(
              (
                item
              ): item is {
                id: string;
                role: "client" | "ai";
                content: string;
                createdAt: string;
              } => item.role === "client" || item.role === "ai"
            )
            .map((item) => ({ id: item.id, role: item.role, content: item.content }))
        );
      })
      .catch((apiError: Error) => {
        setError(apiError.message);
      });
  }, [sessionToken, conversationId]);

  const onStartChat = async () => {
    setSubmitting(true);
    setError(null);

    try {
      const session = await createCustomerSession(companySlug, { name, email });
      setSessionToken(session.sessionToken);
      setConversationId(session.conversationId);
      setCompanyDisplayName(session.companyDisplayName);
      setTicketNotice(null);
    } catch (apiError) {
      setError(apiError instanceof Error ? apiError.message : "Failed to start chat session");
    } finally {
      setSubmitting(false);
    }
  };

  const onSend = async () => {
    if (!sessionToken || !conversationId || !input.trim()) {
      return;
    }

    const outgoing: LocalMessage = {
      id: `temp-${Date.now()}`,
      role: "client",
      content: input.trim()
    };

    setInput("");
    setMessages((current) => [...current, outgoing]);
    setSubmitting(true);
    setError(null);

    try {
      const response = await sendCustomerMessage(conversationId, {
        sessionToken,
        content: outgoing.content
      });

      setMessages((current) => [
        ...current,
        {
          id: response.messageId,
          role: "ai",
          content: response.aiResponse
        }
      ]);

      if (response.ticket) {
        const t = response.ticket;
        const titlePart = t.title ? (t.title.length > 50 ? `${t.title.slice(0, 50)}…` : t.title) : "";
        setTicketNotice(
          titlePart
            ? `Ticket ${t.referenceNumber} created: ${titlePart}`
            : `Ticket ${t.referenceNumber} created (${t.severity}).`
        );
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

  return (
    <div className="container">
      <h1>Customer Support Chat</h1>
      <p className="meta">
        Tenant slug: <strong>{companySlug}</strong>
      </p>

      {!sessionToken ? (
        <section className="card">
          <h2>Start your chat</h2>
          <p className="meta">Name and email are required before conversation begins.</p>
          <div className="form-row">
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Your full name"
              aria-label="Name"
            />
            <input
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@company.com"
              aria-label="Email"
              type="email"
            />
            <button disabled={!canSubmitPreChat || submitting} onClick={onStartChat}>
              {submitting ? "Starting..." : "Start"}
            </button>
          </div>
          {error ? <p className="error">{error}</p> : null}
        </section>
      ) : (
        <section className="card">
          <h2>{companyDisplayName || "Support"}</h2>
          <div className="chat-history">
            {messages.length === 0 ? <p className="meta">No messages yet.</p> : null}
            {messages.map((message) => (
              <div key={message.id} className={`message ${message.role}`}>
                <strong>{message.role === "client" ? "You" : "AI"}:</strong> {message.content}
              </div>
            ))}
          </div>

          {ticketNotice ? <p className="meta">{ticketNotice}</p> : null}

          {showFeedbackPrompt ? (
            <div className="feedback-row" style={{ marginTop: "1rem", padding: "0.5rem 0" }}>
              <p className="meta">Was this helpful?</p>
              <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", flexWrap: "wrap" }}>
                <button type="button" onClick={() => onFeedback("up")} disabled={feedbackSending} aria-label="Thumbs up">
                  👍
                </button>
                <button type="button" onClick={() => onFeedback("down")} disabled={feedbackSending} aria-label="Thumbs down">
                  👎
                </button>
                <input
                  type="text"
                  value={feedbackComment}
                  onChange={(e) => setFeedbackComment(e.target.value)}
                  placeholder="Optional comment"
                  style={{ maxWidth: "200px", padding: "0.35rem" }}
                />
              </div>
            </div>
          ) : feedbackSubmitted ? (
            <p className="meta" style={{ marginTop: "0.5rem" }}>Thank you for your feedback.</p>
          ) : null}

          <div className="input-row">
            <input
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder="Describe your issue"
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  onSend();
                }
              }}
            />
            <button disabled={submitting || !input.trim()} onClick={onSend}>
              {submitting ? "Sending..." : "Send"}
            </button>
          </div>

          {error ? <p className="error">{error}</p> : null}
        </section>
      )}
    </div>
  );
};
