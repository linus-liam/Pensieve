import type { MemoryEntry } from "./types";
export interface SessionMessage { id: string; role: "user" | "assistant"; content: string; created_at: string }
export interface ReviewDraft { id: string; text: string; created_at: string; source_message_ids: string[]; author?: "user" }
export interface ReflectionSession {
  id: string; created_at: string; updated_at: string; status: "active" | "review" | "completed";
  messages: SessionMessage[]; drafts: ReviewDraft[]; current_draft_id: string | null;
  memory_revisions: MemoryEntry[];
}
export interface SessionListItem { id: string; title: string; updated_at: string; status: ReflectionSession["status"]; message_count: number }
export interface LocalInfo { directory: string; aiEnabled: boolean; model: string; provider: string }
