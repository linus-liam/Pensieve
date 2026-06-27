import type { CapturedMemoryEntry, MemoryEntry } from "../types";
import { getSupabaseAccessToken } from "../auth/supabaseClient";

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? "/api";

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
    throw new Error(message);
  }

  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export const api = {
  listMemoryEntries: () => request<MemoryEntry[]>("/memory-entries?limit=100"),

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
