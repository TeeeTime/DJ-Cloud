"use client";

import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { Track } from "@/lib/data";
import { tracksApi } from "@/lib/api";
import { usePagedTracks, FetchTracksPageParams } from "@/lib/use-paged-tracks";
import { useDebouncedValue } from "@/lib/use-debounced-value";

type FilterType = { type: 'all' | 'playlist' | 'genre', value: string };
type SortConfig = { key: keyof Track, direction: 'asc' | 'desc' } | null;

const DEFAULT_SORT_KEY = 'title';
const ACTIVE_TRACKS_POLL_INTERVAL_MS = 3000;

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
  activeTrackOrder: Track[];
  setActiveTrackOrder: React.Dispatch<React.SetStateAction<Track[] | null>>;
  // Lets the active view override what happens when skip-forward runs past the end of its order —
  // e.g. the Overview page's "new tracks" list extends itself instead of looping. Returns the new,
  // extended order, or null if there's genuinely nothing more (caller should then loop to the start).
  onOrderExhausted: (() => Promise<Track[] | null>) | null;
  setOnOrderExhausted: React.Dispatch<React.SetStateAction<(() => Promise<Track[] | null>) | null>>;
  tracksLoading: boolean;
  tracksLoadingMore: boolean;
  tracksError: string | null;
  hasMoreTracks: boolean;
  loadMoreTracks: () => void;
  refreshTracks: () => Promise<void>;
  handleSort: (key: keyof Track) => void;
  themeIndex: number;
  setThemeIndex: React.Dispatch<React.SetStateAction<number>>;
  searchQuery: string;
  setSearchQuery: React.Dispatch<React.SetStateAction<string>>;
  audioRef: React.RefObject<HTMLAudioElement | null>;
}

const PlayerContext = createContext<PlayerContextType | undefined>(undefined);

const fetchLibraryPage = (params: FetchTracksPageParams) => tracksApi.list(params);

export function PlayerProvider({ children }: { children: React.ReactNode }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [selectedTrack, setSelectedTrack] = useState<Track | null>(null);
  const [scratching, setScratching] = useState(false);
  const [activeFilter, setActiveFilter] = useState<FilterType>({ type: 'all', value: 'All Tracks' });
  const [sortConfig, setSortConfig] = useState<SortConfig>(null);
  const [themeIndex, setThemeIndex] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const debouncedSearchQuery = useDebouncedValue(searchQuery);
  const audioRef = React.useRef<HTMLAudioElement>(null);
  const [registeredOrder, setRegisteredOrder] = useState<Track[] | null>(null);
  const [onOrderExhausted, setOnOrderExhausted] = useState<(() => Promise<Track[] | null>) | null>(null);

  const {
    tracks,
    isLoading: tracksLoading,
    isLoadingMore: tracksLoadingMore,
    error: tracksError,
    hasMore: hasMoreTracks,
    loadMore: loadMoreTracks,
    reset: resetTracks,
    refreshLoaded,
  } = usePagedTracks({
    query: debouncedSearchQuery,
    sortConfig,
    defaultSortKey: DEFAULT_SORT_KEY,
    fetchPage: fetchLibraryPage,
  });

  // While any track is still QUEUED/PROCESSING, its status can change server-side (via the
  // analysis pipeline) without any user action here, so poll until nothing is left in flight.
  const hasActiveTracks = tracks.some(t => t.status === 'QUEUED' || t.status === 'PROCESSING');

  useEffect(() => {
    if (!hasActiveTracks) return;
    const interval = setInterval(refreshLoaded, ACTIVE_TRACKS_POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [hasActiveTracks, refreshLoaded]);

  const refreshTracks = useCallback(async () => {
    resetTracks();
  }, [resetTracks]);

  // Default to the first track once the library loads, without forcing playback.
  const currentTrack = selectedTrack ?? tracks[0] ?? null;

  // Whichever view is currently mounted (genre/playlist/overview) can override this with its own
  // visible order; falls back to the library list when nothing has registered one.
  const activeTrackOrder = registeredOrder ?? tracks;

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
      activeTrackOrder,
      setActiveTrackOrder: setRegisteredOrder,
      onOrderExhausted,
      setOnOrderExhausted,
      tracksLoading,
      tracksLoadingMore,
      tracksError,
      hasMoreTracks,
      loadMoreTracks,
      refreshTracks,
      themeIndex,
      setThemeIndex,
      searchQuery,
      setSearchQuery,
      audioRef,
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
