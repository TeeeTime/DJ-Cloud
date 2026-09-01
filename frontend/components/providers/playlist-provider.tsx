"use client";

import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { PlaylistResponse, playlistsApi } from "@/lib/api";
import { useAuth } from "@/components/providers/auth-provider";

interface PlaylistContextType {
  playlists: PlaylistResponse[];
  playlistsLoading: boolean;
  playlistsError: string | null;
  refreshPlaylists: () => Promise<void>;
}

const PlaylistContext = createContext<PlaylistContextType | undefined>(undefined);

export function PlaylistProvider({ children }: { children: React.ReactNode }) {
  const { token } = useAuth();
  const [playlists, setPlaylists] = useState<PlaylistResponse[]>([]);
  const [playlistsLoading, setPlaylistsLoading] = useState(true);
  const [playlistsError, setPlaylistsError] = useState<string | null>(null);

  const refreshPlaylists = useCallback(async () => {
    if (!token) return;
    setPlaylistsLoading(true);
    try {
      const list = await playlistsApi.list(token);
      setPlaylists(list);
      setPlaylistsError(null);
    } catch {
      setPlaylistsError("Could not load playlists from the server.");
    } finally {
      setPlaylistsLoading(false);
    }
  }, [token]);

  // Playlists are per-user (unlike the public track list), so reload — or clear — whenever the
  // signed-in account changes. The whole chain is written inline (no synchronous setState calls
  // in the effect body itself) — see player-provider.tsx's tracks-loading effect for the same
  // pattern and why: react-hooks/set-state-in-effect flags a called function's setState too.
  useEffect(() => {
    const fetchOrClear = token ? playlistsApi.list(token) : Promise.resolve<PlaylistResponse[]>([]);
    fetchOrClear
      .then((list) => {
        setPlaylists(list);
        setPlaylistsError(null);
      })
      .catch(() => setPlaylistsError("Could not load playlists from the server."))
      .finally(() => setPlaylistsLoading(false));
  }, [token]);

  return (
    <PlaylistContext.Provider value={{ playlists, playlistsLoading, playlistsError, refreshPlaylists }}>
      {children}
    </PlaylistContext.Provider>
  );
}

export function usePlaylists() {
  const context = useContext(PlaylistContext);
  if (context === undefined) {
    throw new Error("usePlaylists must be used within a PlaylistProvider");
  }
  return context;
}
