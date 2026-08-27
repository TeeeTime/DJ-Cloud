"use client";

import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { Track, mapTrackResponse } from "@/lib/data";
import { tracksApi } from "@/lib/api";

type FilterType = { type: 'all' | 'playlist' | 'genre', value: string };
type SortConfig = { key: keyof Track, direction: 'asc' | 'desc' } | null;

interface PlayerContextType {
  isPlaying: boolean;
  setIsPlaying: React.Dispatch<React.SetStateAction<boolean>>;
  currentTrack: Track | null;
  setCurrentTrack: React.Dispatch<React.SetStateAction<Track | null>>;
  scratching: boolean;
  setScratching: React.Dispatch<React.SetStateAction<boolean>>;
  activeFilter: FilterType;
  setActiveFilter: React.Dispatch<React.SetStateAction<FilterType>>;
  sortConfig: SortConfig;
  setSortConfig: React.Dispatch<React.SetStateAction<SortConfig>>;
  tracks: Track[];
  tracksLoading: boolean;
  tracksError: string | null;
  refreshTracks: () => Promise<void>;
  filteredTracks: Track[];
  sortedTracks: Track[];
  handleSort: (key: keyof Track) => void;
  themeIndex: number;
  setThemeIndex: React.Dispatch<React.SetStateAction<number>>;
  searchQuery: string;
  setSearchQuery: React.Dispatch<React.SetStateAction<string>>;
  audioRef: React.RefObject<HTMLAudioElement | null>;
}

const PlayerContext = createContext<PlayerContextType | undefined>(undefined);

export function PlayerProvider({ children }: { children: React.ReactNode }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [selectedTrack, setSelectedTrack] = useState<Track | null>(null);
  const [scratching, setScratching] = useState(false);
  const [activeFilter, setActiveFilter] = useState<FilterType>({ type: 'all', value: 'All Tracks' });
  const [sortConfig, setSortConfig] = useState<SortConfig>(null);
  const [themeIndex, setThemeIndex] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [tracks, setTracks] = useState<Track[]>([]);
  const [tracksLoading, setTracksLoading] = useState(true);
  const [tracksError, setTracksError] = useState<string | null>(null);
  const audioRef = React.useRef<HTMLAudioElement>(null);

  const applyTracksPage = useCallback((page: Awaited<ReturnType<typeof tracksApi.list>>) => {
    setTracks(page.content.map(mapTrackResponse));
    setTracksError(null);
  }, []);

  // The .then/.catch/.finally chain must be written inline in the effect — delegating
  // to a called function (even an async one) trips react-hooks/set-state-in-effect.
  useEffect(() => {
    tracksApi.list({ size: 200, sortBy: 'title' })
      .then(applyTracksPage)
      .catch(() => setTracksError("Could not load tracks from the server."))
      .finally(() => setTracksLoading(false));
  }, [applyTracksPage]);

  const refreshTracks = useCallback(async () => {
    setTracksLoading(true);
    try {
      const page = await tracksApi.list({ size: 200, sortBy: 'title' });
      applyTracksPage(page);
    } catch {
      setTracksError("Could not load tracks from the server.");
    } finally {
      setTracksLoading(false);
    }
  }, [applyTracksPage]);

  // Default to the first track once the library loads, without forcing playback.
  const currentTrack = selectedTrack ?? tracks[0] ?? null;

  // Filter tracks based on active selection and search query
  const filteredTracks = tracks.filter(track => {
    // 1. Search Query
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      if (!track.title.toLowerCase().includes(query) && !track.artist.toLowerCase().includes(query)) {
        return false;
      }
    }

    // 2. Active Filter
    if (activeFilter.type === 'all') return true;
    if (activeFilter.type === 'playlist') return track.playlist === activeFilter.value;
    if (activeFilter.type === 'genre') return track.genre === activeFilter.value;
    return true;
  });

  const sortedTracks = [...filteredTracks].sort((a, b) => {
    if (!sortConfig) return 0;
    const { key, direction } = sortConfig;
    const aVal = a[key] ?? '';
    const bVal = b[key] ?? '';
    if (aVal < bVal) return direction === 'asc' ? -1 : 1;
    if (aVal > bVal) return direction === 'asc' ? 1 : -1;
    return 0;
  });

  const handleSort = (key: keyof Track) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  return (
    <PlayerContext.Provider value={{
      isPlaying,
      setIsPlaying,
      currentTrack,
      setCurrentTrack: setSelectedTrack,
      scratching,
      setScratching,
      activeFilter,
      setActiveFilter,
      sortConfig,
      setSortConfig,
      tracks,
      tracksLoading,
      tracksError,
      refreshTracks,
      themeIndex,
      setThemeIndex,
      searchQuery,
      setSearchQuery,
      audioRef,
      filteredTracks,
      sortedTracks,
      handleSort,
    }}>
      {/* Hidden Audio Element for actual playback */}
      <audio
        ref={audioRef}
        src={currentTrack?.audioUrl}
        onEnded={() => setIsPlaying(false)}
        preload="metadata"
      />
      {children}
    </PlayerContext.Provider>
  );
}

export function usePlayer() {
  const context = useContext(PlayerContext);
  if (context === undefined) {
    throw new Error("usePlayer must be used within a PlayerProvider");
  }
  return context;
}
