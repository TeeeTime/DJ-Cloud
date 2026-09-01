"use client";

import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { genresApi } from "@/lib/api";

interface GenreContextType {
  genreNames: string[];
  genresLoading: boolean;
  refreshGenres: () => Promise<void>;
}

const GenreContext = createContext<GenreContextType | undefined>(undefined);

function sortedNames(distribution: { name: string }[]): string[] {
  return distribution.map(g => g.name).sort((a, b) => a.localeCompare(b));
}

export function GenreProvider({ children }: { children: React.ReactNode }) {
  const [genreNames, setGenreNames] = useState<string[]>([]);
  const [genresLoading, setGenresLoading] = useState(true);

  const refreshGenres = useCallback(async () => {
    try {
      const distribution = await genresApi.distribution();
      setGenreNames(sortedNames(distribution));
    } catch {
      // Silent — the sidebar just keeps whatever list it already had.
    }
  }, []);

  // The .then/.catch/.finally chain must be written inline in the effect — delegating to a
  // called function (even one defined with useCallback) trips react-hooks/set-state-in-effect.
  useEffect(() => {
    genresApi.distribution()
      .then((distribution) => setGenreNames(sortedNames(distribution)))
      .catch(() => {})
      .finally(() => setGenresLoading(false));
  }, []);

  return (
    <GenreContext.Provider value={{ genreNames, genresLoading, refreshGenres }}>
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
