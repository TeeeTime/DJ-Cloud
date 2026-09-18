"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { SlidersHorizontal, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { usePlayer } from "@/components/providers/player-provider";
import { useGenres } from "@/components/providers/genre-provider";
import { TrackFilters, hasActiveTrackFilters, tracksApi } from "@/lib/api";

const DEFAULT_MIN_BPM = 60;
const DEFAULT_MAX_BPM = 200;
const DEFAULT_MIN_DURATION = 0;
const DEFAULT_MAX_DURATION = 900; // 15 min

type TrackBounds = {
  minBpm: number;
  maxBpm: number;
  minDurationSeconds: number;
  maxDurationSeconds: number;
};

type DraftFilters = {
  bpm: [number, number];
  durationSeconds: [number, number];
  genres: string[];
};

function clamp(val: number, min: number, max: number): number {
  return Math.min(Math.max(val, min), max);
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function getBpmDisplay(bpm: [number, number], minBound: number, maxBound: number): string {
  const [min, max] = bpm;
  if (min <= minBound && max >= maxBound) {
    return "All";
  }
  if (min === max) {
    return `${min} BPM`;
  }
  if (min <= minBound) {
    return `≤ ${max} BPM`;
  }
  if (max >= maxBound) {
    return `≥ ${min} BPM`;
  }
  return `${min} – ${max} BPM`;
}

function getDurationDisplay(duration: [number, number], minBound: number, maxBound: number): string {
  const [min, max] = duration;
  if (min <= minBound && max >= maxBound) {
    return "All";
  }
  if (min === max) {
    return `${formatDuration(min)} min`;
  }
  if (min <= minBound) {
    return `≤ ${formatDuration(max)} min`;
  }
  if (max >= maxBound) {
    return `≥ ${formatDuration(min)} min`;
  }
  return `${formatDuration(min)} – ${formatDuration(max)} min`;
}

function toDraft(filters: TrackFilters, bounds: TrackBounds): DraftFilters {
  return {
    bpm: [
      filters.minBpm !== undefined ? clamp(filters.minBpm, bounds.minBpm, bounds.maxBpm) : bounds.minBpm,
      filters.maxBpm !== undefined ? clamp(filters.maxBpm, bounds.minBpm, bounds.maxBpm) : bounds.maxBpm,
    ],
    durationSeconds: [
      filters.minDurationSeconds !== undefined
        ? clamp(filters.minDurationSeconds, bounds.minDurationSeconds, bounds.maxDurationSeconds)
        : bounds.minDurationSeconds,
      filters.maxDurationSeconds !== undefined
        ? clamp(filters.maxDurationSeconds, bounds.minDurationSeconds, bounds.maxDurationSeconds)
        : bounds.maxDurationSeconds,
    ],
    genres: filters.genres ?? [],
  };
}

function toFilters(draft: DraftFilters, bounds: TrackBounds): TrackFilters {
  const filters: TrackFilters = {};

  if (draft.bpm[0] === draft.bpm[1]) {
    filters.minBpm = Math.round(draft.bpm[0]);
    filters.maxBpm = Math.round(draft.bpm[1]);
  } else {
    if (draft.bpm[0] > bounds.minBpm) filters.minBpm = Math.round(draft.bpm[0]);
    if (draft.bpm[1] < bounds.maxBpm) filters.maxBpm = Math.round(draft.bpm[1]);
  }

  if (draft.durationSeconds[0] === draft.durationSeconds[1]) {
    filters.minDurationSeconds = Math.round(draft.durationSeconds[0]);
    filters.maxDurationSeconds = Math.round(draft.durationSeconds[1]);
  } else {
    if (draft.durationSeconds[0] > bounds.minDurationSeconds) {
      filters.minDurationSeconds = Math.round(draft.durationSeconds[0]);
    }
    if (draft.durationSeconds[1] < bounds.maxDurationSeconds) {
      filters.maxDurationSeconds = Math.round(draft.durationSeconds[1]);
    }
  }

  if (draft.genres.length > 0) {
    filters.genres = draft.genres;
  }
  return filters;
}

export function TrackFilterMenu() {
  const { trackFilters, setTrackFilters, tracks } = usePlayer();
  const { genreNames } = useGenres();
  const [open, setOpen] = useState(false);

  // Compute immediate bounds from loaded tracks if available
  const initialBounds = useMemo<TrackBounds>(() => {
    const validBpms = tracks.map(t => t.bpm).filter((b): b is number => typeof b === "number" && b > 0);
    const validDurations = tracks.map(t => t.durationSeconds).filter((d): d is number => typeof d === "number" && d > 0);
    return {
      minBpm: validBpms.length > 0 ? Math.min(...validBpms) : DEFAULT_MIN_BPM,
      maxBpm: validBpms.length > 0 ? Math.max(...validBpms) : DEFAULT_MAX_BPM,
      minDurationSeconds: validDurations.length > 0 ? Math.min(...validDurations) : DEFAULT_MIN_DURATION,
      maxDurationSeconds: validDurations.length > 0 ? Math.max(...validDurations) : DEFAULT_MAX_DURATION,
    };
  }, [tracks]);

  const [bounds, setBounds] = useState<TrackBounds>(initialBounds);
  const [draft, setDraft] = useState<DraftFilters>(() => toDraft(trackFilters, initialBounds));

  // Ensure min !== max for Base UI Slider
  const effectiveMinBpm = bounds.minBpm === bounds.maxBpm ? Math.max(1, bounds.minBpm - 5) : bounds.minBpm;
  const effectiveMaxBpm = bounds.minBpm === bounds.maxBpm ? bounds.maxBpm + 5 : bounds.maxBpm;
  const effectiveMinDuration =
    bounds.minDurationSeconds === bounds.maxDurationSeconds
      ? Math.max(0, bounds.minDurationSeconds - 30)
      : bounds.minDurationSeconds;
  const effectiveMaxDuration =
    bounds.minDurationSeconds === bounds.maxDurationSeconds
      ? bounds.maxDurationSeconds + 30
      : bounds.maxDurationSeconds;

  const effectiveBounds = useMemo<TrackBounds>(
    () => ({
      minBpm: effectiveMinBpm,
      maxBpm: effectiveMaxBpm,
      minDurationSeconds: effectiveMinDuration,
      maxDurationSeconds: effectiveMaxDuration,
    }),
    [effectiveMinBpm, effectiveMaxBpm, effectiveMinDuration, effectiveMaxDuration]
  );

  const fetchExtremes = useCallback(async () => {
    try {
      const res = await tracksApi.extremes();
      setBounds(prev => ({
        minBpm: res.minBpm ?? prev.minBpm,
        maxBpm: res.maxBpm ?? prev.maxBpm,
        minDurationSeconds: res.minDurationSeconds ?? prev.minDurationSeconds,
        maxDurationSeconds: res.maxDurationSeconds ?? prev.maxDurationSeconds,
      }));
    } catch {
      // Keep previous bounds if request fails
    }
  }, []);

  // Fetch full library extremes on mount
  useEffect(() => {
    fetchExtremes();
  }, [fetchExtremes]);

  const activeFilters = hasActiveTrackFilters(trackFilters);

  const handleOpenChange = (nextOpen: boolean) => {
    if (nextOpen) {
      fetchExtremes();
      setDraft(toDraft(trackFilters, effectiveBounds));
    }
    setOpen(nextOpen);
  };

  const toggleGenre = (name: string) => {
    setDraft(prev => ({
      ...prev,
      genres: prev.genres.includes(name) ? prev.genres.filter(g => g !== name) : [...prev.genres, name],
    }));
  };

  const handleBpmChange = (val: number | readonly number[]) => {
    if (Array.isArray(val) && val.length === 2) {
      const sorted: [number, number] = [Math.min(val[0], val[1]), Math.max(val[0], val[1])];
      setDraft(prev => ({ ...prev, bpm: sorted }));
    }
  };

  const handleDurationChange = (val: number | readonly number[]) => {
    if (Array.isArray(val) && val.length === 2) {
      const sorted: [number, number] = [Math.min(val[0], val[1]), Math.max(val[0], val[1])];
      setDraft(prev => ({ ...prev, durationSeconds: sorted }));
    }
  };

  const isBpmFiltered = draft.bpm[0] > effectiveBounds.minBpm || draft.bpm[1] < effectiveBounds.maxBpm;
  const isDurationFiltered =
    draft.durationSeconds[0] > effectiveBounds.minDurationSeconds ||
    draft.durationSeconds[1] < effectiveBounds.maxDurationSeconds;

  const resetBpm = () => {
    setDraft(prev => ({ ...prev, bpm: [effectiveBounds.minBpm, effectiveBounds.maxBpm] }));
  };

  const resetLength = () => {
    setDraft(prev => ({
      ...prev,
      durationSeconds: [effectiveBounds.minDurationSeconds, effectiveBounds.maxDurationSeconds],
    }));
  };

  const handleApply = () => {
    setTrackFilters(toFilters(draft, effectiveBounds));
    setOpen(false);
  };

  const handleClearAll = () => {
    const emptyDraft: DraftFilters = {
      bpm: [effectiveBounds.minBpm, effectiveBounds.maxBpm],
      durationSeconds: [effectiveBounds.minDurationSeconds, effectiveBounds.maxDurationSeconds],
      genres: [],
    };
    setDraft(emptyDraft);
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
        <PopoverContent align="start" className="bg-zinc-950 border-zinc-800 text-white w-80">
          <div className="flex flex-col gap-5">
            {/* BPM Slider Section */}
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-zinc-400 uppercase tracking-wider">
                  BPM
                </label>
                <div className="flex items-center gap-1.5">
                  {isBpmFiltered && (
                    <button
                      type="button"
                      onClick={resetBpm}
                      className="text-[11px] text-zinc-500 hover:text-zinc-300 transition-colors cursor-pointer"
                    >
                      Reset
                    </button>
                  )}
                  <span className="text-xs font-normal tabular-nums px-2 py-0.5 rounded bg-zinc-900 border border-zinc-800 text-zinc-300">
                    {getBpmDisplay(draft.bpm, effectiveBounds.minBpm, effectiveBounds.maxBpm)}
                  </span>
                </div>
              </div>
              <Slider
                value={draft.bpm}
                min={effectiveBounds.minBpm}
                max={effectiveBounds.maxBpm}
                step={1}
                minStepsBetweenValues={0}
                onValueChange={handleBpmChange}
                className="py-1"
              />
              <div className="flex justify-between text-[10px] font-mono text-zinc-500 -mt-1">
                <span>{effectiveBounds.minBpm}</span>
                <span>{effectiveBounds.maxBpm}</span>
              </div>
            </div>

            {/* Length Slider Section */}
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-zinc-400 uppercase tracking-wider">
                  Length
                </label>
                <div className="flex items-center gap-1.5">
                  {isDurationFiltered && (
                    <button
                      type="button"
                      onClick={resetLength}
                      className="text-[11px] text-zinc-500 hover:text-zinc-300 transition-colors cursor-pointer"
                    >
                      Reset
                    </button>
                  )}
                  <span className="text-xs font-normal tabular-nums px-2 py-0.5 rounded bg-zinc-900 border border-zinc-800 text-zinc-300">
                    {getDurationDisplay(
                      draft.durationSeconds,
                      effectiveBounds.minDurationSeconds,
                      effectiveBounds.maxDurationSeconds
                    )}
                  </span>
                </div>
              </div>
              <Slider
                value={draft.durationSeconds}
                min={effectiveBounds.minDurationSeconds}
                max={effectiveBounds.maxDurationSeconds}
                step={1}
                minStepsBetweenValues={0}
                onValueChange={handleDurationChange}
                className="py-1"
              />
              <div className="flex justify-between text-[10px] font-mono text-zinc-500 -mt-1">
                <span>{formatDuration(effectiveBounds.minDurationSeconds)}</span>
                <span>{formatDuration(effectiveBounds.maxDurationSeconds)}</span>
              </div>
            </div>

            {/* Genres Section */}
            <div>
              <label className="text-xs font-medium text-zinc-400 uppercase tracking-wider mb-2 block">Genres</label>
              <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto">
                {genreNames.map(name => {
                  const selected = draft.genres.includes(name);
                  return (
                    <button
                      key={name}
                      type="button"
                      onClick={() => toggleGenre(name)}
                      className={`inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-md border transition-colors cursor-pointer ${
                        selected
                          ? "bg-white text-black border-white font-medium"
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

            {/* Actions */}
            <div className="flex items-center justify-between gap-2 pt-2 border-t border-zinc-800/80">
              <Button variant="ghost" size="sm" onClick={handleClearAll} className="text-zinc-400 hover:text-white cursor-pointer">
                Clear all
              </Button>
              <Button variant="default" size="sm" onClick={handleApply} className="cursor-pointer">
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
          className="text-zinc-500 hover:text-white cursor-pointer"
          onClick={() => setTrackFilters({})}
          title="Clear active filters"
        >
          <X className="w-4 h-4" />
        </Button>
      )}
    </div>
  );
}
