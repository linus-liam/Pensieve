import { createClient } from "@supabase/supabase-js";
import type { Session, SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

function createSupabaseBrowserClient(): SupabaseClient | null {
  if (!supabaseUrl || !supabaseAnonKey) return null;

  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      autoRefreshToken: true,
      detectSessionInUrl: true,
      persistSession: true,
    },
  });
}

export const supabase = createSupabaseBrowserClient();

export async function getSupabaseSession(): Promise<Session | null> {
  if (!supabase) return null;

  const { data, error } = await supabase.auth.getSession();
  if (error) throw new Error(error.message);

  return data.session;
}

export async function getSupabaseAccessToken(): Promise<string | null> {
  const session = await getSupabaseSession();
  return session?.access_token ?? null;
}
