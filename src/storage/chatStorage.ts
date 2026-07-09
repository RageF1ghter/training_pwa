import type { ChatMessage, ChatRole, ChatSummary } from "../types";

const STORAGE_KEY = "fitlog.chatMessages";
const API_KEY_STORAGE = "fitlog.deepseekApiKey";
const SUMMARY_KEY = "fitlog.chatSummary";

const VALID_ROLES: readonly ChatRole[] = ["system", "user", "assistant"];

// System messages are only kept transiently (data snapshot / intro); they are
// NOT persisted — the App rebuilds them on demand. Only user/assistant turns
// survive a reload.
export function readChatMessages(): ChatMessage[] {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    const saved = value ? (JSON.parse(value) as unknown) : [];
    if (!Array.isArray(saved)) return [];
    const seen = new Set<string>();
    const messages: ChatMessage[] = [];
    for (const entry of saved) {
      const message = normalizeChatMessage(entry);
      if (!message || seen.has(message.id)) continue;
      seen.add(message.id);
      messages.push(message);
    }
    return messages.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  } catch {
    return [];
  }
}

export function writeChatMessages(messages: ChatMessage[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
}

export function readApiKey(): string {
  try {
    return localStorage.getItem(API_KEY_STORAGE) ?? "";
  } catch {
    return "";
  }
}

export function writeApiKey(key: string) {
  localStorage.setItem(API_KEY_STORAGE, key);
}

export function readChatSummary(): ChatSummary | null {
  try {
    const value = localStorage.getItem(SUMMARY_KEY);
    const saved = value ? (JSON.parse(value) as Partial<ChatSummary>) : null;
    return normalizeChatSummary(saved);
  } catch {
    return null;
  }
}

export function writeChatSummary(summary: ChatSummary | null) {
  if (summary) {
    localStorage.setItem(SUMMARY_KEY, JSON.stringify(summary));
  } else {
    localStorage.removeItem(SUMMARY_KEY);
  }
}

function normalizeChatMessage(data: unknown): ChatMessage | null {
  if (!data || typeof data !== "object") return null;
  const entry = data as Partial<ChatMessage>;
  const id = typeof entry.id === "string" ? entry.id.trim() : "";
  const content = typeof entry.content === "string" ? entry.content : "";
  const createdAt = typeof entry.createdAt === "string" ? entry.createdAt.trim() : "";
  const role = VALID_ROLES.includes(entry.role as ChatRole) ? (entry.role as ChatRole) : null;
  if (!id || !createdAt || role === null || !content) return null;
  return { id, role, content, createdAt };
}

function normalizeChatSummary(data: Partial<ChatSummary> | null | undefined): ChatSummary | null {
  if (!data || typeof data !== "object") return null;
  const content = typeof data.content === "string" ? data.content : "";
  const summarizedUpTo = typeof data.summarizedUpTo === "string" ? data.summarizedUpTo.trim() : "";
  const createdAt = typeof data.createdAt === "string" ? data.createdAt.trim() : "";
  if (!content || !summarizedUpTo || !createdAt) return null;
  return { content, summarizedUpTo, createdAt };
}
