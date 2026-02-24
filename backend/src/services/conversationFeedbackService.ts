import type { SupabaseClient } from "@supabase/supabase-js";
import { makeId } from "../store/inMemoryStore";
import type { InMemoryStore } from "../store/inMemoryStore";

export class ConversationFeedbackService {
  constructor(
    private readonly store: InMemoryStore,
    private readonly supabase: SupabaseClient | null
  ) {}

  async submit(companyId: string, conversationId: string, rating: "up" | "down", comment?: string | null): Promise<void> {
    if (this.supabase) {
      const existing = await this.getByConversation(companyId, conversationId);
      const now = new Date().toISOString();
      if (existing) {
        const { error } = await this.supabase
          .from("conversation_feedback")
          .update({ rating, comment: comment ?? null })
          .eq("company_id", companyId)
          .eq("conversation_id", conversationId);
        if (error) throw new Error(`Failed to update feedback: ${error.message}`);
        return;
      }
      const id = makeId("feedback");
      const { error } = await this.supabase.from("conversation_feedback").insert({
        id,
        company_id: companyId,
        conversation_id: conversationId,
        rating,
        comment: comment ?? null,
        created_at: now
      });
      if (error) throw new Error(`Failed to save feedback: ${error.message}`);
      return;
    }

    const existing = this.store.conversationFeedback.find(
      (f) => f.companyId === companyId && f.conversationId === conversationId
    );
    if (existing) {
      existing.rating = rating;
      existing.comment = comment ?? null;
      return;
    }

    this.store.conversationFeedback.push({
      id: makeId("feedback"),
      companyId,
      conversationId,
      rating,
      comment: comment ?? null,
      createdAt: new Date().toISOString()
    });
  }

  async getByConversation(companyId: string, conversationId: string): Promise<{ rating: string; comment: string | null } | null> {
    if (this.supabase) {
      const { data, error } = await this.supabase
        .from("conversation_feedback")
        .select("rating, comment")
        .eq("company_id", companyId)
        .eq("conversation_id", conversationId)
        .maybeSingle();
      if (error) return null;
      return data as { rating: string; comment: string | null } | null;
    }

    const record = this.store.conversationFeedback.find(
      (f) => f.companyId === companyId && f.conversationId === conversationId
    );
    if (!record) return null;
    return { rating: record.rating, comment: record.comment };
  }
}
