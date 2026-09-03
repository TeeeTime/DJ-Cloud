"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { Plus, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/components/providers/auth-provider";
import { TrackResponse, tracksApi, playlistsApi, ApiError } from "@/lib/api";
import { useDebouncedValue } from "@/lib/use-debounced-value";

interface PlaylistTrackSearchProps {
  playlistId: number;
  onTrackAdded: () => void;
}

export function PlaylistTrackSearch({ playlistId, onTrackAdded }: PlaylistTrackSearchProps) {
  const { token } = useAuth();
  const [query, setQuery] = useState("");
  const debouncedQuery = useDebouncedValue(query);
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

  // The state updates below must happen inline in the effect body — delegating to a called
  // function (even one defined with useCallback) trips react-hooks/set-state-in-effect. `runSearch`
  // below duplicates this same logic for use from the (non-effect) `handleAdd` event handler.
  useEffect(() => {
    if (!debouncedQuery) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setResults([]);
      return;
    }
    tracksApi.list({ query: debouncedQuery, size: 10, excludePlaylistId: playlistId })
      .then((found) => setResults(found.content))
      .catch((err) => console.error(err));
  }, [debouncedQuery, playlistId]);

  const runSearch = useCallback(async (value: string) => {
    if (!value) {
      setResults([]);
      return;
    }
    try {
      const found = await tracksApi.list({ query: value, size: 10, excludePlaylistId: playlistId });
      setResults(found.content);
    } catch (err) {
      console.error(err);
    }
  }, [playlistId]);

  const handleAdd = async (track: TrackResponse) => {
    if (!token) return;
    setAddingId(track.id);
    try {
      await playlistsApi.addTrack(playlistId, track.id, token);
      onTrackAdded();
      // Re-run the same search so the just-added track drops out of the results.
      await runSearch(debouncedQuery);
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
