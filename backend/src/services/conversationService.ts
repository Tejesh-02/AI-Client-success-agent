import type { SupabaseClient } from "@supabase/supabase-js";
import type { ConversationSummary } from "@clientpulse/types";
import { makeId } from "../store/inMemoryStore";
import type { InMemoryStore } from "../store/inMemoryStore";
import type { Conversation, Message, MessageRole, Role } from "../types/models";

export interface ConversationFilters {
  status?: Conversation["status"];
  sentiment?: Conversation["sentiment"];
  clientId?: string;
}

interface ConversationRow {
  id: string;
  company_id: string;
  client_id: string;
  status: Conversation["status"];
  sentiment: Conversation["sentiment"];
  channel: "hosted_chat";
  started_at: string;
  last_message_at: string;
  ended_at: string | null;
  agent_id: string | null;
  priority_snapshot: Conversation["prioritySnapshot"];
}

interface MessageRow {
  id: string;
  company_id: string;
  conversation_id: string;
  role: MessageRole;
  content: string;
  confidence_score: number | null;
  kb_article_ids: string[] | null;
  model_provider: string | null;
  model_name: string | null;
  token_usage: number | null;
  latency_ms: number | null;
  created_at: string;
}

const mapRowToConversation = (row: ConversationRow): Conversation => ({
  id: row.id,
  companyId: row.company_id,
  clientId: row.client_id,
  status: row.status,
  sentiment: row.sentiment,
  channel: row.channel,
  startedAt: row.started_at,
  lastMessageAt: row.last_message_at,
  endedAt: row.ended_at,
  agentId: row.agent_id,
  prioritySnapshot: row.priority_snapshot
});

const mapRowToMessage = (row: MessageRow): Message => ({
  id: row.id,
  companyId: row.company_id,
  conversationId: row.conversation_id,
  role: row.role,
  content: row.content,
  confidenceScore: row.confidence_score,
  kbArticleIds: row.kb_article_ids ?? [],
  modelProvider: row.model_provider,
  modelName: row.model_name,
  tokenUsage: row.token_usage,
  latencyMs: row.latency_ms,
  createdAt: row.created_at
});

export class ConversationService {
  constructor(
    private readonly store: InMemoryStore,
    private readonly supabase: SupabaseClient | null
  ) {}

  async create(companyId: string, clientId: string): Promise<Conversation> {
    const timestamp = new Date().toISOString();
    const conversation: Conversation = {
      id: makeId("conversation"),
      companyId,
      clientId,
      status: "active",
      sentiment: "neutral",
      channel: "hosted_chat",
      startedAt: timestamp,
      lastMessageAt: timestamp,
      endedAt: null,
      agentId: null,
      prioritySnapshot: null
    };

    if (this.supabase) {
      const payload = {
        id: conversation.id,
        company_id: conversation.companyId,
        client_id: conversation.clientId,
        status: conversation.status,
        sentiment: conversation.sentiment,
        channel: conversation.channel,
        started_at: conversation.startedAt,
        last_message_at: conversation.lastMessageAt,
        ended_at: conversation.endedAt,
        agent_id: conversation.agentId,
        priority_snapshot: conversation.prioritySnapshot
      };

      const { data, error } = await this.supabase
        .from("conversations")
        .insert(payload)
        .select(
          "id, company_id, client_id, status, sentiment, channel, started_at, last_message_at, ended_at, agent_id, priority_snapshot"
        )
        .single();

      if (error) {
        throw new Error(`Failed to create conversation: ${error.message}`);
      }

      return mapRowToConversation(data as ConversationRow);
    }

    this.store.conversations.push(conversation);
    return conversation;
  }

  async findById(companyId: string, conversationId: string): Promise<Conversation | null> {
    if (this.supabase) {
      const { data, error } = await this.supabase
        .from("conversations")
        .select(
          "id, company_id, client_id, status, sentiment, channel, started_at, last_message_at, ended_at, agent_id, priority_snapshot"
        )
        .eq("company_id", companyId)
        .eq("id", conversationId)
        .maybeSingle();

      if (error) {
        throw new Error(`Failed to load conversation: ${error.message}`);
      }

      return data ? mapRowToConversation(data as ConversationRow) : null;
    }

    return (
      this.store.conversations.find(
        (conversation) => conversation.companyId === companyId && conversation.id === conversationId
      ) ?? null
    );
  }

  /** Find the most recent active conversation for this client (for resuming the same chat). */
  async findActiveByClient(companyId: string, clientId: string): Promise<Conversation | null> {
    if (this.supabase) {
      const { data, error } = await this.supabase
        .from("conversations")
        .select(
          "id, company_id, client_id, status, sentiment, channel, started_at, last_message_at, ended_at, agent_id, priority_snapshot"
        )
        .eq("company_id", companyId)
        .eq("client_id", clientId)
        .eq("status", "active")
        .order("last_message_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        throw new Error(`Failed to find active conversation: ${error.message}`);
      }

      return data ? mapRowToConversation(data as ConversationRow) : null;
    }

    const found = this.store.conversations
      .filter((c) => c.companyId === companyId && c.clientId === clientId && c.status === "active")
      .sort((a, b) => b.lastMessageAt.localeCompare(a.lastMessageAt))[0];
    return found ?? null;
  }

  async addMessage(
    companyId: string,
    conversationId: string,
    role: MessageRole,
    content: string,
    metadata?: Partial<Pick<Message, "confidenceScore" | "modelProvider" | "modelName" | "tokenUsage" | "latencyMs">>
  ): Promise<Message> {
    const timestamp = new Date().toISOString();
    const message: Message = {
      id: makeId("message"),
      companyId,
      conversationId,
      role,
      content,
      confidenceScore: metadata?.confidenceScore ?? null,
      kbArticleIds: [],
      modelProvider: metadata?.modelProvider ?? null,
      modelName: metadata?.modelName ?? null,
      tokenUsage: metadata?.tokenUsage ?? null,
      latencyMs: metadata?.latencyMs ?? null,
      createdAt: timestamp
    };

    if (this.supabase) {
      const payload = {
        id: message.id,
        company_id: message.companyId,
        conversation_id: message.conversationId,
        role: message.role,
        content: message.content,
        confidence_score: message.confidenceScore,
        kb_article_ids: message.kbArticleIds,
        model_provider: message.modelProvider,
        model_name: message.modelName,
        token_usage: message.tokenUsage,
        latency_ms: message.latencyMs,
        created_at: message.createdAt
      };

      const { data, error } = await this.supabase
        .from("messages")
        .insert(payload)
        .select(
          "id, company_id, conversation_id, role, content, confidence_score, kb_article_ids, model_provider, model_name, token_usage, latency_ms, created_at"
        )
        .single();

      if (error) {
        throw new Error(`Failed to create message: ${error.message}`);
      }

      const { error: updateError } = await this.supabase
        .from("conversations")
        .update({ last_message_at: message.createdAt })
        .eq("company_id", companyId)
        .eq("id", conversationId);

      if (updateError) {
        throw new Error(`Failed to update conversation timestamp: ${updateError.message}`);
      }

      return mapRowToMessage(data as MessageRow);
    }

    this.store.messages.push(message);
    const conversation = await this.findById(companyId, conversationId);
    if (conversation) {
      conversation.lastMessageAt = timestamp;
    }

    return message;
  }

  async listMessages(companyId: string, conversationId: string): Promise<Message[]> {
    if (this.supabase) {
      const { data, error } = await this.supabase
        .from("messages")
        .select(
          "id, company_id, conversation_id, role, content, confidence_score, kb_article_ids, model_provider, model_name, token_usage, latency_ms, created_at"
        )
        .eq("company_id", companyId)
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: true });

      if (error) {
        throw new Error(`Failed to list messages: ${error.message}`);
      }

      return (data ?? []).map((row) => mapRowToMessage(row as MessageRow));
    }

    return this.store.messages
      .filter((message) => message.companyId === companyId && message.conversationId === conversationId)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }

  async listConversations(
    companyId: string,
    role: Role,
    userId: string,
    filters: ConversationFilters
  ): Promise<ConversationSummary[]> {
    if (this.supabase) {
      let query = this.supabase
        .from("conversations")
        .select("id, company_id, client_id, status, sentiment, channel, last_message_at")
        .eq("company_id", companyId)
        .order("last_message_at", { ascending: false });

      if (filters.status) {
        query = query.eq("status", filters.status);
      }
      if (filters.sentiment) {
        query = query.eq("sentiment", filters.sentiment);
      }
      if (filters.clientId) {
        query = query.eq("client_id", filters.clientId);
      }
      if (role === "agent") {
        query = query.eq("agent_id", userId);
      }

      const { data, error } = await query;
      if (error) {
        throw new Error(`Failed to list conversations: ${error.message}`);
      }

      return (data ?? []).map((row) => {
        const item = row as {
          id: string;
          company_id: string;
          client_id: string;
          status: ConversationSummary["status"];
          sentiment: ConversationSummary["sentiment"];
          channel: ConversationSummary["channel"];
          last_message_at: string;
        };

        return {
          id: item.id,
          companyId: item.company_id,
          clientId: item.client_id,
          status: item.status,
          sentiment: item.sentiment,
          channel: item.channel,
          lastMessageAt: item.last_message_at
        };
      });
    }

    return this.store.conversations
      .filter((conversation) => conversation.companyId === companyId)
      .filter((conversation) => (filters.status ? conversation.status === filters.status : true))
      .filter((conversation) => (filters.sentiment ? conversation.sentiment === filters.sentiment : true))
      .filter((conversation) => (filters.clientId ? conversation.clientId === filters.clientId : true))
      .filter((conversation) => {
        if (role !== "agent") {
          return true;
        }
        return conversation.agentId === userId;
      })
      .map((conversation) => ({
        id: conversation.id,
        companyId: conversation.companyId,
        clientId: conversation.clientId,
        status: conversation.status,
        sentiment: conversation.sentiment,
        channel: conversation.channel,
        lastMessageAt: conversation.lastMessageAt
      }));
  }

  async setPrioritySnapshot(companyId: string, conversationId: string, severity: Conversation["prioritySnapshot"]): Promise<void> {
    if (this.supabase) {
      const { error } = await this.supabase
        .from("conversations")
        .update({ priority_snapshot: severity })
        .eq("company_id", companyId)
        .eq("id", conversationId);

      if (error) {
        throw new Error(`Failed to update conversation priority snapshot: ${error.message}`);
      }

      return;
    }

    const conversation = await this.findById(companyId, conversationId);
    if (conversation) {
      conversation.prioritySnapshot = severity;
    }
  }

  async setSentiment(companyId: string, conversationId: string, sentiment: Conversation["sentiment"]): Promise<void> {
    if (this.supabase) {
      const { error } = await this.supabase
        .from("conversations")
        .update({ sentiment })
        .eq("company_id", companyId)
        .eq("id", conversationId);

      if (error) {
        throw new Error(`Failed to update conversation sentiment: ${error.message}`);
      }

      return;
    }

    const conversation = await this.findById(companyId, conversationId);
    if (conversation) {
      conversation.sentiment = sentiment;
    }
  }

  async setHandedOff(companyId: string, conversationId: string, agentId: string): Promise<void> {
    if (this.supabase) {
      const { error } = await this.supabase
        .from("conversations")
        .update({ status: "handed_off", agent_id: agentId })
        .eq("company_id", companyId)
        .eq("id", conversationId);

      if (error) {
        throw new Error(`Failed to set conversation handed off: ${error.message}`);
      }

      return;
    }

    const conversation = await this.findById(companyId, conversationId);
    if (conversation) {
      conversation.status = "handed_off";
      conversation.agentId = agentId;
    }
  }
}
