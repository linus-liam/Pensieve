export interface Chat {
  id: string;
  user_id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

export interface Message {
  id: string;
  chat_id: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
}

export type Theme = "light" | "dark";

export interface User {
  id: string;
  email: string;
}

export interface ColorTokens {
  paper: string;
  paperEdge: string;
  ink: string;
  inkSoft: string;
  inkFaint: string;
  rule: string;
  accent: string;
  sidebar: string;
}

export type MemorySourceType = "text" | "screenshot" | "photo" | "voice";

export interface Memory {
  id: string;
  day: string;
  time: string;
  source: string;
  sourceType: MemorySourceType;
  content: string;
  tags: string[];
  image?: string;
  imageAlt?: string;
}
