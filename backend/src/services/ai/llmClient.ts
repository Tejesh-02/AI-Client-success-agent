export type SupportedAiProvider = "groq" | "openai_compatible";

export interface AiReply {
  content: string;
  confidence: number;
  tokenUsage: number;
  latencyMs: number;
  provider: SupportedAiProvider;
  model: string;
}

/** One turn in the conversation for context. role is OpenAI-style user/assistant. */
export interface ConversationTurn {
  role: "user" | "assistant";
  content: string;
}

const SUPPORT_PERSONA_NAME = "KLEO";

const fallbackReply = (prompt: string): string => {
  const lc = prompt.toLowerCase();

  if (lc.includes("refund") || lc.includes("billing")) {
    return "I’m sorry that’s been frustrating. I’ve flagged this for our billing team so they can look into it and get back to you with a clear answer.";
  }

  if (lc.includes("error") || lc.includes("failed")) {
    return "I want to make sure we fix this. Can you paste the exact error message or a screenshot? That will help me route you to the right person or solution right away.";
  }

  return "Thanks for getting in touch. I’ve noted this and I’m here to help — could you share a bit more so we can get it resolved?";
};

export class LlmClient {
  private readonly provider: SupportedAiProvider;
  private readonly model: string;
  private readonly apiKey: string | undefined;
  private readonly baseUrl: string;

  constructor() {
    this.provider = (process.env.AI_PROVIDER as SupportedAiProvider | undefined) ?? "groq";

    if (this.provider === "groq") {
      this.apiKey = process.env.GROQ_API_KEY;
      const raw = process.env.GROQ_MODEL ?? "llama-3.3-70b-versatile";
      // Groq expects ids like openai/gpt-oss-20b; allow bare gpt-oss-20b
      this.model = raw.includes("/") ? raw : raw.startsWith("gpt-oss-") ? `openai/${raw}` : raw;
      this.baseUrl = process.env.GROQ_BASE_URL ?? "https://api.groq.com/openai/v1";
      return;
    }

    this.apiKey = process.env.AI_API_KEY;
    this.model = process.env.AI_MODEL ?? "gpt-4o-mini";
    this.baseUrl = process.env.AI_BASE_URL ?? "https://api.openai.com/v1";
  }

  async generateReply(
    message: string,
    companyContext?: string,
    conversationHistory?: ConversationTurn[]
  ): Promise<AiReply> {
    const start = Date.now();

    if (!this.apiKey) {
      return {
        content: fallbackReply(message),
        confidence: 0.68,
        tokenUsage: 0,
        latencyMs: Date.now() - start,
        provider: this.provider,
        model: this.model
      };
    }

    const systemParts = [
      `You are ${SUPPORT_PERSONA_NAME}, a customer success support agent. Your role is to help the customer resolve their issue.`,
      "Be empathetic and clear: acknowledge their issue first, show you're there to solve it, then give concrete steps or offer to escalate.",
      "Use a warm, professional tone. Do not make up information; if unsure, say so and offer to have a team member follow up.",
      "Keep replies concise but complete. Stay on-topic."
    ];
    if (companyContext && companyContext.trim()) {
      systemParts.push(
        "\n\nUse the company knowledge below when relevant to answer; otherwise be helpful and offer to escalate.\n\n" +
          companyContext.trim()
      );
    }

    const maxHistoryTurns = 10;
    const history = (conversationHistory ?? []).slice(-maxHistoryTurns);

    const messages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [
      { role: "system", content: systemParts.join("\n\n") },
      ...history,
      { role: "user", content: message }
    ];

    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`
      },
      body: JSON.stringify({
        model: this.model,
        temperature: 0.2,
        messages
      })
    });

    if (!response.ok) {
      const text = await response.text();
      // On model not found / 4xx, return fallback so chat doesn't 500
      if (response.status >= 400 && response.status < 500) {
        console.error(`AI provider (${this.provider}) ${response.status}: ${text}`);
        return {
          content: fallbackReply(message),
          confidence: 0.5,
          tokenUsage: 0,
          latencyMs: Date.now() - start,
          provider: this.provider,
          model: this.model
        };
      }
      throw new Error(`AI provider error (${this.provider}): ${response.status} ${text}`);
    }

    const payload = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
      usage?: { total_tokens?: number };
    };

    const content = payload.choices?.[0]?.message?.content?.trim() || fallbackReply(message);
    const tokenUsage = payload.usage?.total_tokens ?? 0;

    return {
      content,
      confidence: 0.82,
      tokenUsage,
      latencyMs: Date.now() - start,
      provider: this.provider,
      model: this.model
    };
  }
}
