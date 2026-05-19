import { useCallback, useEffect, useState } from "react";
import { api } from "../api/client";
import type { User } from "../types";

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    api
      .me()
      .then(({ user }) => {
        if (active) setUser(user);
      })
      .catch(() => {
        if (active) setUser(null);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    setError(null);
    const result = await api.login(email, password);
    setUser(result.user);
  }, []);

  const register = useCallback(async (email: string, password: string) => {
    setError(null);
    const result = await api.register(email, password);
    setUser(result.user);
  }, []);

  const logout = useCallback(async () => {
    setError(null);
    await api.logout();
    setUser(null);
  }, []);

  return { user, loading, error, setError, login, register, logout };
}
