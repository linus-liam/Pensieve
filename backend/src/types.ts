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
