import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { getSupabaseSession, isSupabaseConfigured, supabase } from "./supabaseClient";

interface AuthContextValue {
  error: string | null;
  loading: boolean;
  session: Session | null;
  signingOut: boolean;
  user: User | null;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [signingOut, setSigningOut] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    if (!supabase) {
      setLoading(false);
      return () => {
        mounted = false;
      };
    }

    getSupabaseSession()
      .then((nextSession) => {
        if (!mounted) return;
        setSession(nextSession);
      })
      .catch((sessionError) => {
        if (!mounted) return;
        setError(sessionError instanceof Error ? sessionError.message : "Could not load session");
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setError(null);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signInWithGoogle = useCallback(async () => {
    if (!supabase || !isSupabaseConfigured) {
      setError("Supabase auth is not configured.");
      return;
    }

    setError(null);

    const { error: signInError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: window.location.origin,
      },
    });

    if (signInError) setError(signInError.message);
  }, []);

  const signOut = useCallback(async () => {
    if (!supabase) return;

    setSigningOut(true);
    setError(null);

    try {
      const { error: signOutError } = await supabase.auth.signOut();
      if (signOutError) throw signOutError;
      setSession(null);
    } catch (signOutError) {
      setError(signOutError instanceof Error ? signOutError.message : "Could not sign out");
    } finally {
      setSigningOut(false);
    }
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      error,
      loading,
      session,
      signingOut,
      user: session?.user ?? null,
      signInWithGoogle,
      signOut,
    }),
    [error, loading, session, signInWithGoogle, signOut, signingOut]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used within AuthProvider");
  return value;
}
