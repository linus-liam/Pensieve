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

export interface MemoryProposal {
  title: string;
  summary: string;
  evidence: ProposalEvidence[];
}

export type ReflectionMessageRole = "assistant" | "user";
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
  state?: "exploring" | "proposal_ready";
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

export interface ReflectionChatMessage {
  id?: string;
  role: ReflectionMessageRole;
  content: string;
}

export interface ReflectionAIMessage {
  id: string;
  role: ReflectionMessageRole;
  content: string;
}

export interface ProposalEvidence {
  userMessageId: string;
  excerpt: string;
}

export type ReflectionTurnResponse =
  | {
      state: "exploring";
      reply: string;
      memoryProposal: null;
    }
  | {
      state: "proposal_ready";
      reply: string;
      memoryProposal: MemoryProposal;
    };
