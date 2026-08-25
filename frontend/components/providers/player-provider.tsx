"use client";

import React, { createContext, useContext, useState } from "react";
import { Track, mockTracks } from "@/lib/data";

type FilterType = { type: 'all' | 'playlist' | 'genre', value: string };
type SortConfig = { key: keyof Track, direction: 'asc' | 'desc' } | null;

interface PlayerContextType {
  isPlaying: boolean;
  setIsPlaying: React.Dispatch<React.SetStateAction<boolean>>;
  currentTrack: Track;
  setCurrentTrack: React.Dispatch<React.SetStateAction<Track>>;
  stemsOpen: boolean;
  setStemsOpen: React.Dispatch<React.SetStateAction<boolean>>;
  scratching: boolean;
  setScratching: React.Dispatch<React.SetStateAction<boolean>>;
  activeFilter: FilterType;
  setActiveFilter: React.Dispatch<React.SetStateAction<FilterType>>;
  sortConfig: SortConfig;
  setSortConfig: React.Dispatch<React.SetStateAction<SortConfig>>;
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
  const [currentTrack, setCurrentTrack] = useState<Track>(mockTracks[0]);
  const [stemsOpen, setStemsOpen] = useState(false);
  const [scratching, setScratching] = useState(false);
  const [activeFilter, setActiveFilter] = useState<FilterType>({ type: 'all', value: 'All Tracks' });
  const [sortConfig, setSortConfig] = useState<SortConfig>(null);
  const [themeIndex, setThemeIndex] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const audioRef = React.useRef<HTMLAudioElement>(null);

  // Filter tracks based on active selection and search query
  const filteredTracks = mockTracks.filter(track => {
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
      setCurrentTrack,
      stemsOpen,
      setStemsOpen,
      scratching,
      setScratching,
      activeFilter,
      setActiveFilter,
      sortConfig,
      setSortConfig,
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
        src={currentTrack.audioUrl} 
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
