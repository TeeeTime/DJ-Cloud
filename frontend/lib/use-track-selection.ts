"use client";

import { useCallback, useMemo, useState } from "react";
import { Track } from "@/lib/data";

/**
 * Multi-select state for a track list view (library/playlist/genre). The exposed selection is
 * derived by filtering the raw selected-id state against the currently-loaded `tracks` array on
 * every render — a search/sort-triggered reset replaces that array (dropping any now-absent
 * selected id), while an infinite-scroll append is a pure superset (no-op), so this one derivation
 * correctly handles both without a separate effect/setState pass.
 */
export function useTrackSelection(tracks: Track[]) {
  const [selectMode, setSelectMode] = useState(false);
  const [rawSelectedIds, setRawSelectedIds] = useState<Set<number>>(new Set());

  const trackIdSet = useMemo(() => new Set(tracks.map(t => t.id)), [tracks]);

  const selectedIds = useMemo(() => {
    if (rawSelectedIds.size === 0) return rawSelectedIds;
    const filtered = new Set([...rawSelectedIds].filter(id => trackIdSet.has(id)));
    return filtered.size === rawSelectedIds.size ? rawSelectedIds : filtered;
  }, [rawSelectedIds, trackIdSet]);

  const toggle = useCallback((id: number) => {
    setRawSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const selectAll = useCallback(() => {
    setRawSelectedIds(new Set(trackIdSet));
  }, [trackIdSet]);

  const clearSelection = useCallback(() => setRawSelectedIds(new Set()), []);

  const enterSelectMode = useCallback(() => setSelectMode(true), []);

  const cancel = useCallback(() => {
    setSelectMode(false);
    setRawSelectedIds(new Set());
  }, []);

  return {
    selectMode,
    enterSelectMode,
    cancel,
    selectedIds,
    selectedCount: selectedIds.size,
    isSelected: (id: number) => selectedIds.has(id),
    toggle,
    selectAll,
    clearSelection,
  };
}
