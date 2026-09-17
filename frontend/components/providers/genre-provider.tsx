"use client";

import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { GenreSyncResponse, genresApi } from "@/lib/api";
import { useAuth } from "@/components/providers/auth-provider";

interface GenreContextType {
  genreNames: string[];
  genresLoading: boolean;
  refreshGenres: () => Promise<void>;
  genreSyncs: GenreSyncResponse[];
  genreSyncsLoading: boolean;
  refreshGenreSyncs: () => Promise<void>;
}

const GenreContext = createContext<GenreContextType | undefined>(undefined);

function sortedNames(distribution: { name: string }[]): string[] {
  return distribution.map(g => g.name).sort((a, b) => a.localeCompare(b));
}

export function GenreProvider({ children }: { children: React.ReactNode }) {
  const { token } = useAuth();
  const [genreNames, setGenreNames] = useState<string[]>([]);
  const [genresLoading, setGenresLoading] = useState(true);

  const [genreSyncs, setGenreSyncs] = useState<GenreSyncResponse[]>([]);
  const [genreSyncsLoading, setGenreSyncsLoading] = useState(true);

  const refreshGenres = useCallback(async () => {
    try {
      const distribution = await genresApi.distribution();
      setGenreNames(sortedNames(distribution));
    } catch {
      // Silent — the sidebar just keeps whatever list it already had.
    }
  }, []);

  const refreshGenreSyncs = useCallback(async () => {
    if (!token) return;
    try {
      const list = await genresApi.list(token);
      setGenreSyncs(list);
    } catch {
      // Silent — callers just keep whatever sync state they already had.
    }
  }, [token]);

  // The .then/.catch/.finally chain must be written inline in the effect — delegating to a
  // called function (even one defined with useCallback) trips react-hooks/set-state-in-effect.
  useEffect(() => {
    genresApi.distribution()
      .then((distribution) => setGenreNames(sortedNames(distribution)))
      .catch(() => {})
      .finally(() => setGenresLoading(false));
  }, []);

  // Sync state is per-user (unlike the public distribution above), so reload — or clear — whenever
  // the signed-in account changes.
  useEffect(() => {
    const fetchOrClear = token ? genresApi.list(token) : Promise.resolve<GenreSyncResponse[]>([]);
    fetchOrClear
      .then((list) => setGenreSyncs(list))
      .catch(() => {})
      .finally(() => setGenreSyncsLoading(false));
  }, [token]);

  return (
    <GenreContext.Provider value={{
      genreNames, genresLoading, refreshGenres,
      genreSyncs, genreSyncsLoading, refreshGenreSyncs,
    }}>
      {children}
    </GenreContext.Provider>
  );
}

export function useGenres() {
  const context = useContext(GenreContext);
  if (context === undefined) {
    throw new Error("useGenres must be used within a GenreProvider");
  }
  return context;
}
