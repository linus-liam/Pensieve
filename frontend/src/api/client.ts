import type { MemoryEntry } from "../types";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => null);
    const message =
      typeof body?.error === "string" ? body.error : res.statusText || "Request failed";
    throw new Error(message);
  }

  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export const api = {
  listMemoryEntries: () => request<MemoryEntry[]>("/memory-entries?limit=100"),

  createMemoryEntry: (rawInput: string) =>
    request<MemoryEntry>("/memory-entries", {
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
