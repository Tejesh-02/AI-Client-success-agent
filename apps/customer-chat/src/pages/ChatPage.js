import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { createCustomerSession, getTranscript, sendCustomerMessage } from "../lib/api";
export const ChatPage = () => {
    const { companySlug = "" } = useParams();
    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [input, setInput] = useState("");
    const [sessionToken, setSessionToken] = useState(null);
    const [conversationId, setConversationId] = useState(null);
    const [companyDisplayName, setCompanyDisplayName] = useState("");
    const [messages, setMessages] = useState([]);
    const [ticketNotice, setTicketNotice] = useState(null);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState(null);
    const canSubmitPreChat = useMemo(() => name.trim().length > 0 && email.trim().length > 3, [name, email]);
    useEffect(() => {
        if (!sessionToken || !conversationId) {
            return;
        }
        getTranscript(conversationId, sessionToken)
            .then((items) => {
            setMessages(items
                .filter((item) => item.role === "client" || item.role === "ai")
                .map((item) => ({ id: item.id, role: item.role, content: item.content })));
        })
            .catch((apiError) => {
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
        }
        catch (apiError) {
            setError(apiError instanceof Error ? apiError.message : "Failed to start chat session");
        }
        finally {
            setSubmitting(false);
        }
    };
    const onSend = async () => {
        if (!sessionToken || !conversationId || !input.trim()) {
            return;
        }
        const outgoing = {
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
                setTicketNotice(`Ticket ${response.ticket.referenceNumber} was created with ${response.ticket.severity} severity.`);
            }
            else {
                setTicketNotice(null);
            }
        }
        catch (apiError) {
            setError(apiError instanceof Error ? apiError.message : "Failed to send message");
        }
        finally {
            setSubmitting(false);
        }
    };
    return (_jsxs("div", { className: "container", children: [_jsx("h1", { children: "Customer Support Chat" }), _jsxs("p", { className: "meta", children: ["Tenant slug: ", _jsx("strong", { children: companySlug })] }), !sessionToken ? (_jsxs("section", { className: "card", children: [_jsx("h2", { children: "Start your chat" }), _jsx("p", { className: "meta", children: "Name and email are required before conversation begins." }), _jsxs("div", { className: "form-row", children: [_jsx("input", { value: name, onChange: (event) => setName(event.target.value), placeholder: "Your full name", "aria-label": "Name" }), _jsx("input", { value: email, onChange: (event) => setEmail(event.target.value), placeholder: "you@company.com", "aria-label": "Email", type: "email" }), _jsx("button", { disabled: !canSubmitPreChat || submitting, onClick: onStartChat, children: submitting ? "Starting..." : "Start" })] }), error ? _jsx("p", { className: "error", children: error }) : null] })) : (_jsxs("section", { className: "card", children: [_jsx("h2", { children: companyDisplayName || "Support" }), _jsxs("div", { className: "chat-history", children: [messages.length === 0 ? _jsx("p", { className: "meta", children: "No messages yet." }) : null, messages.map((message) => (_jsxs("div", { className: `message ${message.role}`, children: [_jsxs("strong", { children: [message.role === "client" ? "You" : "AI", ":"] }), " ", message.content] }, message.id)))] }), ticketNotice ? _jsx("p", { className: "meta", children: ticketNotice }) : null, _jsxs("div", { className: "input-row", children: [_jsx("input", { value: input, onChange: (event) => setInput(event.target.value), placeholder: "Describe your issue", onKeyDown: (event) => {
                                    if (event.key === "Enter") {
                                        onSend();
                                    }
                                } }), _jsx("button", { disabled: submitting || !input.trim(), onClick: onSend, children: submitting ? "Sending..." : "Send" })] }), error ? _jsx("p", { className: "error", children: error }) : null] }))] }));
};
