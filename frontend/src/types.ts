export interface MemoryEntry {
  id: string;
  raw_input: string;
  ai_summary: string;
  created_at: string;
  updated_at: string;
}

export type MemorySourceType = "text" | "screenshot" | "photo" | "voice";

export interface Memory {
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
