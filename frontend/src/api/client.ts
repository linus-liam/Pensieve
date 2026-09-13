import type { ReflectionSession, SessionListItem, LocalInfo, BackupStatus } from "../sessionTypes";
import { localMode, localToken, mobileMode } from "../local";
import type { CapturedMemoryEntry, MemoryEntry } from "../types";
import { getSupabaseAccessToken } from "../auth/supabaseClient";
import { mobileRequest, exportMobileMarkdown } from "../mobile/api";
import type { MaterialBackup, MaterialInput, MaterialSummary, RawMaterial } from "../../../backend/src/imports/materials";

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? "/api";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  if (mobileMode) return mobileRequest<T>(path, init);
  const accessToken = localMode ? null : await getSupabaseAccessToken();
  if (!localMode && !accessToken) throw new Error("Please sign in again.");

  const res = await fetch(`${apiBaseUrl}${path}`, {
    ...init,
    headers: {
      ...(localMode ? { "X-Pensieve-Local-Token": localToken } : { Authorization: `Bearer ${accessToken}` }),
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
  listMaterials: () => request<MaterialSummary[]>("/materials"),
  getMaterial: (id: string) => request<RawMaterial>(`/materials/${id}`),
  importMaterial: (input: MaterialInput) => request<{ material: MaterialSummary; duplicate: boolean }>("/materials", { method: "POST", body: JSON.stringify(input) }),
  restoreMaterial: (backup: MaterialBackup) => request<{ material: MaterialSummary; duplicate: boolean }>("/materials/restore", { method: "POST", body: JSON.stringify(backup) }),
  listMemoryEntries: (archived = false) => request<MemoryEntry[]>(`/memory-entries?limit=100${localMode ? `&archived=${archived}` : ""}`),

  listSessions: () => request<SessionListItem[]>("/sessions"),
  getSession: (id: string) => request<ReflectionSession>(`/sessions/${id}`),
  createSession: (id: string) => request<ReflectionSession>("/sessions", { method: "POST", body: JSON.stringify({ id }) }),
  appendMessage: (sessionId: string, id: string, content: string) => request<ReflectionSession>(`/sessions/${sessionId}/messages`, { method: "POST", body: JSON.stringify({ id, content }) }),
  reply: (sessionId: string, id: string, review = false) => request<ReflectionSession>(`/sessions/${sessionId}/respond`, { method: "POST", body: JSON.stringify({ id, review, cloudConsent: true, timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone }) }),
  confirmReview: (id: string, text: string, draftId: string | null) => request<ReflectionSession>(`/sessions/${id}/confirm`, { method: "POST", body: JSON.stringify({ text, draftId }) }),
  saveReviewDraft: (id: string, text: string, draftId: string | null) => request<ReflectionSession>(`/sessions/${id}/review-draft`, { method: "POST", body: JSON.stringify({ text, draftId }) }),
  continueSession: (id: string) => request<ReflectionSession>(`/sessions/${id}/continue`, { method: "POST" }),

  localInfo: () => request<LocalInfo>("/local-info"),
  backup: () => request<BackupStatus>("/backups", { method: "POST" }),
  history: (id: string) => request<MemoryRevision[]>(`/memory-entries/${id}/history`),
  restore: (id: string) => request<MemoryEntry>(`/memory-entries/${id}/restore`, { method: "POST" }),
  exportMarkdown: async () => {
    if (mobileMode) return exportMobileMarkdown();
    const res = await fetch(`${apiBaseUrl}/export`, { headers: { "X-Pensieve-Local-Token": localToken } });
    if (!res.ok) throw new Error("导出失败，请重试");
    const url = URL.createObjectURL(await res.blob());
    const link = document.createElement("a");
    link.href = url; link.download = "pensieve-memories.md"; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  },

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

export interface MemoryRevision extends MemoryEntry { revision: number; action: string; archived: boolean }
