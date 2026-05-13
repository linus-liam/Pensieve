export interface Chat {
  id: string;
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
