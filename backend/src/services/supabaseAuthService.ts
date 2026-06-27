import { createClient } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";
import { AppError } from "../errors.js";

export interface AuthenticatedUser {
  email: string | null;
  id: string;
}

let supabaseAuthClient: SupabaseClient | null = null;

function getSupabaseAuthClient() {
  if (supabaseAuthClient) return supabaseAuthClient;

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new AppError(500, "Supabase auth is not configured", "auth_not_configured");
  }

  supabaseAuthClient = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  return supabaseAuthClient;
}

export async function getAuthenticatedUser(accessToken: string): Promise<AuthenticatedUser> {
  const { data, error } = await getSupabaseAuthClient().auth.getUser(accessToken);

  if (error || !data.user) {
    throw new AppError(401, "invalid or expired session", "invalid_session");
  }

  return {
    email: data.user.email ?? null,
    id: data.user.id,
  };
}
