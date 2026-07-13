export interface MemoryEntry {
  id: string;
  user_id: string;
  session_id: string | null;
  title: string;
  raw_input: string;
  ai_summary: string;
  created_at: string;
  updated_at: string;
}

export interface CapturedMemoryEntry extends MemoryEntry {
  acknowledgement: string;
}

export interface MemoryProposal {
  title: string;
  summary: string;
  evidence: ProposalEvidence[];
}

export type ReflectionMessageRole = "assistant" | "user";

export interface ProposalEvidence {
  userMessageId: string;
  excerpt: string;
}

export type ReflectionSessionStatus = "active" | "completed" | "archived";

export interface ReflectionSession {
  id: string;
  user_id: string;
  title: string;
  status: ReflectionSessionStatus;
  created_at: string;
  updated_at: string;
}

export interface ReflectionMessageMetadata {
  state?: "exploring" | "paused" | "proposal_ready";
  memoryProposal?: MemoryProposal;
  proposalState?: "pending" | "dismissed" | "saved";
  memoryEntryId?: string;
}

export interface ReflectionMessage {
  id: string;
  session_id: string;
  user_id: string;
  client_message_id: string | null;
  reply_to_message_id: string | null;
  role: ReflectionMessageRole;
  content: string;
  metadata: ReflectionMessageMetadata;
  created_at: string;
}

export interface ReflectionSessionDetail {
  session: ReflectionSession;
  messages: ReflectionMessage[];
}

export interface ReflectionMessagePair {
  userMessage: ReflectionMessage;
  assistantMessage: ReflectionMessage;
  replayed: boolean;
}

export interface ConfirmReflectionMemoryInput {
  assistantMessageId: string;
  title: string;
  summary: string;
}

export interface ReflectionTurnMessage {
  role: ReflectionMessageRole;
  content: string;
}

export interface ReflectionTurnResponse {
  reply: string;
  memoryProposal?: MemoryProposal;
}

export type MemorySourceType = "text" | "screenshot" | "photo" | "voice";

export interface Memory {
  id: string;
  sessionId: string | null;
  title: string;
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
