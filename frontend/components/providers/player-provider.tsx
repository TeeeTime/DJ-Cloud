"use client";

import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { Track, isPlayableStatus } from "@/lib/data";
import { tracksApi, authApi, TrackFilters } from "@/lib/api";
import { usePagedTracks, FetchTracksPageParams } from "@/lib/use-paged-tracks";
import { useDebouncedValue } from "@/lib/use-debounced-value";
import { appendMediaToken, setMediaToken } from "@/lib/media-token";
import { useAuth } from "@/components/providers/auth-provider";

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
  trackFilters: TrackFilters;
  setTrackFilters: React.Dispatch<React.SetStateAction<TrackFilters>>;
  audioRef: React.RefObject<HTMLAudioElement | null>;
  ambientMode: boolean;
  setAmbientMode: React.Dispatch<React.SetStateAction<boolean>>;
  toggleAmbientMode: () => void;
  // True while handleAudioError is minting a fresh media token and reloading the <audio> src —
  // BottomPlayer's play/pause-sync effect must not call .play() during this window (see there).
  audioNeedsRetry: boolean;
}

const PlayerContext = createContext<PlayerContextType | undefined>(undefined);

const fetchLibraryPage = (params: FetchTracksPageParams) => tracksApi.list(params);

const AMBIENT_STORAGE_KEY = "djcloud_ambient_mode";

function loadStoredAmbient(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return localStorage.getItem(AMBIENT_STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}

export function PlayerProvider({ children }: { children: React.ReactNode }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [selectedTrack, setSelectedTrack] = useState<Track | null>(null);
  const [scratching, setScratching] = useState(false);
  const [ambientMode, setAmbientMode] = useState(loadStoredAmbient);

  const toggleAmbientMode = useCallback(() => {
    setAmbientMode(prev => {
      const next = !prev;
      try {
        localStorage.setItem(AMBIENT_STORAGE_KEY, String(next));
      } catch {}
      return next;
    });
  }, []);
  const [activeFilter, setActiveFilter] = useState<FilterType>({ type: 'all', value: 'All Tracks' });
  const [sortConfig, setSortConfig] = useState<SortConfig>(null);
  const [themeIndex, setThemeIndex] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const debouncedSearchQuery = useDebouncedValue(searchQuery);
  const [trackFilters, setTrackFilters] = useState<TrackFilters>({});
  const audioRef = React.useRef<HTMLAudioElement>(null);
  const { token: authToken } = useAuth();
  const [audioNeedsRetry, setAudioNeedsRetry] = useState(false);
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
    filters: trackFilters,
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

  // Default to the first ready track once the library loads, without forcing playback — a
  // not-yet-processed track (no preview available yet) must never be auto-selected.
  const currentTrack = selectedTrack ?? tracks.find(t => isPlayableStatus(t.status)) ?? null;

  // The <audio> element's src is recomputed fresh from currentTrack on every render (not read
  // directly off the frozen currentTrack.audioUrl field, whose baked-in media token — see
  // lib/data.ts — can be stale, e.g. unset on first paint before AuthProvider's token fetch
  // resolves). handleAudioError below can override it with a freshly re-minted one via
  // retriedAudioSrc — also doubling as the "already retried this track" guard, since it's non-null
  // only after a retry — cleared whenever the track itself changes, using the same
  // compare-during-render reset idiom as TrackThumbnail/TrackCover (see track-row-parts.tsx) rather
  // than an effect, so it doesn't cost an extra render pass.
  const baseAudioSrc = currentTrack ? appendMediaToken(tracksApi.audioUrl(currentTrack.id)) : undefined;
  const [retriedAudioSrc, setRetriedAudioSrc] = useState<string | undefined>(undefined);
  const [prevTrackId, setPrevTrackId] = useState<number | null>(null);
  if ((currentTrack?.id ?? null) !== prevTrackId) {
    setPrevTrackId(currentTrack?.id ?? null);
    setRetriedAudioSrc(undefined);
  }
  const audioSrc = retriedAudioSrc ?? baseAudioSrc;

  // Whichever view is currently mounted (genre/playlist/overview) can override this with its own
  // visible order; falls back to the library list when nothing has registered one.
  const activeTrackOrder = registeredOrder ?? tracks;

  // The media token embedded in audioSrc is short-lived — if it's missing (first-paint race, before
  // the initial media-token fetch resolves) or has expired (idle for a while), mint a fresh one and
  // retry the same track once instead of leaving playback stuck on 401.
  const handleAudioError = useCallback(async () => {
    if (!currentTrack || !authToken || retriedAudioSrc !== undefined) return;
    setAudioNeedsRetry(true);

    try {
      const { token } = await authApi.mediaToken(authToken);
      setMediaToken(token);
      setRetriedAudioSrc(appendMediaToken(tracksApi.audioUrl(currentTrack.id)));
    } finally {
      // Flip back regardless of outcome — on genuine failure, the play/pause-sync effect below
      // re-running is what surfaces the real error instead of leaving playback silently stuck.
      setAudioNeedsRetry(false);
    }
  }, [currentTrack, authToken, retriedAudioSrc]);

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
      trackFilters,
      setTrackFilters,
      audioRef,
      audioNeedsRetry,
      handleSort,
      ambientMode,
      setAmbientMode,
      toggleAmbientMode,
    }}>
      {/* Hidden Audio Element for actual playback */}
      <audio
        ref={audioRef}
        src={audioSrc}
        onEnded={() => setIsPlaying(false)}
        onError={handleAudioError}
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
