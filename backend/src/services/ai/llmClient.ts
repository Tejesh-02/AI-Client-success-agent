export type SupportedAiProvider = "groq" | "openai_compatible";

export interface AiReply {
  content: string;
  confidence: number;
  tokenUsage: number;
  latencyMs: number;
  provider: SupportedAiProvider;
  model: string;
}

const fallbackReply = (prompt: string): string => {
  const lc = prompt.toLowerCase();

  if (lc.includes("refund") || lc.includes("billing")) {
    return "I can help with billing questions. I am escalating this to the billing team for a detailed follow-up.";
  }

  if (lc.includes("error") || lc.includes("failed")) {
    return "I can see this is blocking your workflow. Please share the exact error text, and I will route this to the support team if needed.";
  }

  return "Thanks for sharing the details. I have noted your request and can continue helping here.";
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

  async generateReply(message: string, companyContext?: string): Promise<AiReply> {
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
      "You are a customer success AI assistant. Be concise, avoid fabricated claims, and escalate when uncertain."
    ];
    if (companyContext && companyContext.trim()) {
      systemParts.push(
        "\n\nUse the following company knowledge when answering. Base your answers on this when relevant:\n\n" +
          companyContext.trim()
      );
    }

    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`
      },
      body: JSON.stringify({
        model: this.model,
        temperature: 0.2,
        messages: [
          {
            role: "system",
            content: systemParts.join("")
          },
          {
            role: "user",
            content: message
          }
        ]
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
