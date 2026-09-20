"use client";

import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { ApiError, authApi, Role } from "@/lib/api";
import { setMediaToken } from "@/lib/media-token";

const TOKEN_STORAGE_KEY = "djcloud_token";
// Tokens are valid 7 days server-side; refresh well before that so an open tab never gets logged out.
const REFRESH_INTERVAL_MS = 60 * 60 * 1000;
// Media tokens are valid 2 minutes server-side (app.media-token.expiration) — refresh well before that
// so <audio>/<img> src URLs built while a tab stays open keep carrying a live token.
const MEDIA_TOKEN_REFRESH_INTERVAL_MS = 90 * 1000;

function refreshMediaToken(token: string) {
  authApi
    .mediaToken(token)
    .then((res) => setMediaToken(res.token))
    .catch(() => setMediaToken(null));
}

export interface AuthUser {
  username: string;
  role: Role;
}

interface AuthContextType {
  user: AuthUser | null;
  token: string | null;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Rehydrate the session from a stored token on first load.
  useEffect(() => {
    const stored = localStorage.getItem(TOKEN_STORAGE_KEY);
    const validated = stored ? authApi.me(stored) : Promise.reject();

    validated
      .then((me) => {
        setToken(stored as string);
        setUser({ username: me.username, role: me.role });
        refreshMediaToken(stored as string);
      })
      .catch(() => {
        if (stored) localStorage.removeItem(TOKEN_STORAGE_KEY);
      })
      .finally(() => setIsLoading(false));
  }, []);

  // Keep long-lived sessions alive while the tab stays open.
  useEffect(() => {
    if (!token) return;
    const interval = setInterval(() => {
      authApi
        .refresh(token)
        .then((res) => {
          localStorage.setItem(TOKEN_STORAGE_KEY, res.token);
          setToken(res.token);
        })
        .catch(() => {
          localStorage.removeItem(TOKEN_STORAGE_KEY);
          setToken(null);
          setUser(null);
        });
    }, REFRESH_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [token]);

  // Keep the media token (used for <audio>/<img> src URLs) fresh while the tab stays open.
  useEffect(() => {
    if (!token) return;
    const interval = setInterval(() => refreshMediaToken(token), MEDIA_TOKEN_REFRESH_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [token]);

  const login = useCallback(async (username: string, password: string) => {
    const res = await authApi.login(username, password);
    localStorage.setItem(TOKEN_STORAGE_KEY, res.token);
    setToken(res.token);
    setUser({ username: res.username, role: res.role });
    refreshMediaToken(res.token);
  }, []);

  const logout = useCallback(async () => {
    if (token) {
      try {
        await authApi.logout(token);
      } catch (err) {
        // Token may already be expired/invalidated — fall through to local cleanup either way.
        if (!(err instanceof ApiError)) throw err;
      }
    }
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    setToken(null);
    setUser(null);
    setMediaToken(null);
  }, [token]);

  return (
    <AuthContext.Provider value={{ user, token, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
