const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:4000";
const parseJson = async (response) => {
    if (!response.ok) {
        const payload = await response.json().catch(() => ({ error: "Unknown API error" }));
        throw new Error(payload.error ?? `Request failed with ${response.status}`);
    }
    return (await response.json());
};
export const createCustomerSession = async (companySlug, payload) => {
    const response = await fetch(`${API_URL}/public/v1/tenants/${companySlug}/session`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
    });
    return parseJson(response);
};
export const sendCustomerMessage = async (conversationId, payload) => {
    const response = await fetch(`${API_URL}/public/v1/conversations/${conversationId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
    });
    return parseJson(response);
};
export const getTranscript = async (conversationId, sessionToken) => {
    const response = await fetch(`${API_URL}/public/v1/conversations/${conversationId}/messages?sessionToken=${encodeURIComponent(sessionToken)}`);
    const payload = await parseJson(response);
    return payload.items;
};
