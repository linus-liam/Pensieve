export interface MemoryEntry {
  source_session_id?: string;
  id: string;
  user_id: string;
  raw_input: string;
  ai_summary: string;
  created_at: string;
  updated_at: string;
}

export interface CapturedMemoryEntry extends MemoryEntry {
  acknowledgement: string;
}

export type MemorySourceType = "text" | "screenshot" | "photo" | "voice";

export interface Memory {
  sourceSessionId?: string;
  id: string;
  day: string;
  time: string;
  source: string;
  sourceType: MemorySourceType;
  summary: string;
  rawInput: string;
  tags: string[];
  image?: string;
  imageAlt?: string;
}
