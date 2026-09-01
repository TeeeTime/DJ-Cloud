"use client";

import React, { useEffect, useRef, useState } from "react";
import { Plus, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/components/providers/auth-provider";
import { TrackResponse, tracksApi, playlistsApi, ApiError } from "@/lib/api";

interface PlaylistTrackSearchProps {
  playlistId: number;
  onTrackAdded: () => void;
}

export function PlaylistTrackSearch({ playlistId, onTrackAdded }: PlaylistTrackSearchProps) {
  const { token } = useAuth();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<TrackResponse[]>([]);
  const [showResults, setShowResults] = useState(false);
  const [addingId, setAddingId] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowResults(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const runSearch = async (value: string) => {
    if (!value) {
      setResults([]);
      return;
    }
    try {
      const found = await tracksApi.search(value, 10, playlistId);
      setResults(found);
    } catch (err) {
      console.error(err);
    }
  };

  const handleAdd = async (track: TrackResponse) => {
    if (!token) return;
    setAddingId(track.id);
    try {
      await playlistsApi.addTrack(playlistId, track.id, token);
      onTrackAdded();
      // Re-run the same search so the just-added track drops out of the results.
      await runSearch(query);
    } catch (err) {
      console.error(err instanceof ApiError ? err.message : err);
    } finally {
      setAddingId(null);
    }
  };

  return (
    <div ref={containerRef} className="relative w-full max-w-md group">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 group-focus-within:text-white transition-colors" />
      <Input
        placeholder="Search tracks to add..."
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          runSearch(e.target.value);
          setShowResults(true);
        }}
        onFocus={() => setShowResults(true)}
        className="pl-9 bg-black border-zinc-800 text-white focus-visible:ring-1 focus-visible:ring-zinc-700 focus-visible:border-zinc-700 transition-all rounded-md h-10 placeholder:text-zinc-600"
      />

      {showResults && results.length > 0 && (
        <div className="absolute z-10 w-full mt-1 bg-zinc-900 border border-zinc-800 rounded-md shadow-lg max-h-64 overflow-y-auto">
          {results.map(track => (
            <div
              key={track.id}
              className="w-full flex items-center justify-between gap-3 px-3 py-2 text-sm hover:bg-zinc-800"
            >
              <div className="min-w-0">
                <p className="truncate text-zinc-200">{track.title}</p>
                <p className="truncate text-xs text-zinc-500">
                  {track.artists.length > 0 ? track.artists.join(", ") : "Unknown Artist"}
                </p>
              </div>
              <button
                onClick={() => handleAdd(track)}
                disabled={addingId === track.id}
                className="shrink-0 flex items-center justify-center h-7 w-7 text-zinc-400 hover:text-white hover:bg-zinc-700 rounded-md transition-colors disabled:opacity-50"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
