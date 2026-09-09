"use client";

import React, { useState } from "react";
import { SlidersHorizontal, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { usePlayer } from "@/components/providers/player-provider";
import { useGenres } from "@/components/providers/genre-provider";
import { TrackFilters, hasActiveTrackFilters } from "@/lib/api";

type DraftFilters = {
  minBpm: string;
  maxBpm: string;
  minLengthMinutes: string;
  maxLengthMinutes: string;
  genres: string[];
};

const EMPTY_DRAFT: DraftFilters = { minBpm: "", maxBpm: "", minLengthMinutes: "", maxLengthMinutes: "", genres: [] };

// Restyles the native number-input spin buttons so they don't look out of place against the
// app's dark theme: `color-scheme:dark` gets Firefox (and Chrome) to render them with dark
// native chrome instead of a jarring light-mode widget, and the webkit pseudo-elements get a
// bit of spacing/opacity polish on top since Chrome/Edge otherwise render them flush and dim.
const NUMBER_INPUT_CLASS =
  "bg-zinc-900/50 border-zinc-800 [color-scheme:dark] " +
  "[&::-webkit-inner-spin-button]:ml-1.5 [&::-webkit-inner-spin-button]:opacity-70 [&::-webkit-inner-spin-button]:cursor-pointer [&::-webkit-inner-spin-button]:hover:opacity-100 " +
  "[&::-webkit-outer-spin-button]:cursor-pointer";

function toDraft(filters: TrackFilters): DraftFilters {
  return {
    minBpm: filters.minBpm !== undefined ? String(filters.minBpm) : "",
    maxBpm: filters.maxBpm !== undefined ? String(filters.maxBpm) : "",
    minLengthMinutes: filters.minDurationSeconds !== undefined ? String(filters.minDurationSeconds / 60) : "",
    maxLengthMinutes: filters.maxDurationSeconds !== undefined ? String(filters.maxDurationSeconds / 60) : "",
    genres: filters.genres ?? [],
  };
}

function toFilters(draft: DraftFilters): TrackFilters {
  const filters: TrackFilters = {};
  if (draft.minBpm !== "") filters.minBpm = Number(draft.minBpm);
  if (draft.maxBpm !== "") filters.maxBpm = Number(draft.maxBpm);
  if (draft.minLengthMinutes !== "") filters.minDurationSeconds = Math.round(Number(draft.minLengthMinutes) * 60);
  if (draft.maxLengthMinutes !== "") filters.maxDurationSeconds = Math.round(Number(draft.maxLengthMinutes) * 60);
  if (draft.genres.length > 0) filters.genres = draft.genres;
  return filters;
}

export function TrackFilterMenu() {
  const { trackFilters, setTrackFilters } = usePlayer();
  const { genreNames } = useGenres();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<DraftFilters>(EMPTY_DRAFT);

  const activeFilters = hasActiveTrackFilters(trackFilters);

  const handleOpenChange = (nextOpen: boolean) => {
    if (nextOpen) setDraft(toDraft(trackFilters));
    setOpen(nextOpen);
  };

  const toggleGenre = (name: string) => {
    setDraft(prev => ({
      ...prev,
      genres: prev.genres.includes(name) ? prev.genres.filter(g => g !== name) : [...prev.genres, name],
    }));
  };

  const handleApply = () => {
    setTrackFilters(toFilters(draft));
    setOpen(false);
  };

  const handleClearAll = () => {
    setDraft(EMPTY_DRAFT);
    setTrackFilters({});
  };

  return (
    <div className="flex items-center gap-1 shrink-0">
      <Popover open={open} onOpenChange={handleOpenChange}>
        <PopoverTrigger
          render={
            <Button variant="outline" size="icon" className="relative text-zinc-400 hover:text-white" />
          }
        >
          <SlidersHorizontal className="w-4 h-4" />
          {activeFilters && (
            <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-white" />
          )}
        </PopoverTrigger>
        <PopoverContent align="start" className="bg-zinc-950 border-zinc-800 text-white">
          <div className="flex flex-col gap-4">
            <div>
              <label className="text-xs font-medium text-zinc-400 uppercase tracking-wider mb-1.5 block">BPM</label>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  placeholder="Min"
                  value={draft.minBpm}
                  onChange={(e) => setDraft(prev => ({ ...prev, minBpm: e.target.value }))}
                  className={NUMBER_INPUT_CLASS}
                />
                <span className="text-zinc-600 text-xs">to</span>
                <Input
                  type="number"
                  placeholder="Max"
                  value={draft.maxBpm}
                  onChange={(e) => setDraft(prev => ({ ...prev, maxBpm: e.target.value }))}
                  className={NUMBER_INPUT_CLASS}
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-medium text-zinc-400 uppercase tracking-wider mb-1.5 block">Length (min)</label>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  placeholder="Min"
                  value={draft.minLengthMinutes}
                  onChange={(e) => setDraft(prev => ({ ...prev, minLengthMinutes: e.target.value }))}
                  className={NUMBER_INPUT_CLASS}
                />
                <span className="text-zinc-600 text-xs">to</span>
                <Input
                  type="number"
                  placeholder="Max"
                  value={draft.maxLengthMinutes}
                  onChange={(e) => setDraft(prev => ({ ...prev, maxLengthMinutes: e.target.value }))}
                  className={NUMBER_INPUT_CLASS}
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-medium text-zinc-400 uppercase tracking-wider mb-1.5 block">Genres</label>
              <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto">
                {genreNames.map(name => {
                  const selected = draft.genres.includes(name);
                  return (
                    <button
                      key={name}
                      type="button"
                      onClick={() => toggleGenre(name)}
                      className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded-md border transition-colors ${
                        selected
                          ? "bg-white text-black border-white"
                          : "bg-zinc-900 border-zinc-800 text-zinc-300 hover:border-zinc-700"
                      }`}
                    >
                      {name}
                    </button>
                  );
                })}
                {genreNames.length === 0 && <p className="text-xs text-zinc-500">No genres yet</p>}
              </div>
            </div>

            {/* Transparent border in place of the old visible separator — same box size (and
                therefore same spacing above this row) as the border it replaces, just invisible. */}
            <div className="flex items-center justify-between gap-2 pt-1 border-t border-transparent">
              <Button variant="ghost" size="sm" onClick={handleClearAll} className="text-zinc-400 hover:text-white">
                Clear all
              </Button>
              <Button variant="default" size="sm" onClick={handleApply}>
                Apply
              </Button>
            </div>
          </div>
        </PopoverContent>
      </Popover>

      {activeFilters && (
        <Button
          variant="ghost"
          size="icon"
          className="text-zinc-500 hover:text-white"
          onClick={() => setTrackFilters({})}
          title="Clear active filters"
        >
          <X className="w-4 h-4" />
        </Button>
      )}
    </div>
  );
}
