import type {
  CapturedMemoryEntry,
  ConfirmReflectionMemoryInput,
  MemoryEntry,
  ReflectionMessagePair,
  ReflectionSessionDetail,
} from "../types";
import { getSupabaseAccessToken } from "../auth/supabaseClient";

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? "/api";

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const accessToken = await getSupabaseAccessToken();
  if (!accessToken) throw new Error("Please sign in again.");

  const res = await fetch(`${apiBaseUrl}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => null);
    const message =
      typeof body?.error === "string" ? body.error : res.statusText || "Request failed";
    throw new ApiError(message, res.status, typeof body?.code === "string" ? body.code : undefined);
  }

  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export const api = {
  listMemoryEntries: () => request<MemoryEntry[]>("/memory-entries?limit=100"),

  getActiveReflectionSession: () =>
    request<ReflectionSessionDetail>("/reflection-sessions/active"),

  createReflectionSession: () =>
    request<ReflectionSessionDetail>("/reflection-sessions", { method: "POST" }),

  getReflectionSession: (sessionId: string) =>
    request<ReflectionSessionDetail>(`/reflection-sessions/${sessionId}`),

  sendReflectionMessage: (sessionId: string, content: string, clientMessageId: string) =>
    request<ReflectionMessagePair>(`/reflection-sessions/${sessionId}/messages`, {
      method: "POST",
      body: JSON.stringify({ content, clientMessageId }),
    }),

  confirmReflectionMemory: (sessionId: string, input: ConfirmReflectionMemoryInput) =>
    request<MemoryEntry>(`/reflection-sessions/${sessionId}/memory`, {
      method: "POST",
      body: JSON.stringify(input),
    }),

  createMemoryEntry: (rawInput: string) =>
    request<CapturedMemoryEntry>("/memory-entries", {
      method: "POST",
      body: JSON.stringify({ rawInput }),
    }),

  getMemoryEntry: (id: string, signal?: AbortSignal) =>
    request<MemoryEntry>(`/memory-entries/${id}`, { signal }),

  updateMemoryEntry: (id: string, rawInput: string) =>
    request<MemoryEntry>(`/memory-entries/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ rawInput }),
    }),

  deleteMemoryEntry: (id: string) =>
    request<void>(`/memory-entries/${id}`, { method: "DELETE" }),
};
