export interface MemoryEntry {
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
