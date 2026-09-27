"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { PageResponse, TrackFilters, TrackResponse } from "@/lib/api";
import { Track, mapTrackResponse } from "@/lib/data";

export type SortDirection = "asc" | "desc";
export type SortConfig = { key: string; direction: SortDirection } | null;

const DEFAULT_PAGE_SIZE = 30;
const ACTIVE_TRACKS_POLL_INTERVAL_MS = 3000;

// A stable reference for callers that omit `filters` — an inline `{}` default would be a fresh
// object every render, and since `filters` sits in effect/callback dependency arrays below, that
// would retrigger the fetch on every render (infinite loop).
const EMPTY_FILTERS: TrackFilters = {};

export interface FetchTracksPageParams extends TrackFilters {
  page: number;
  size: number;
  sortBy: string;
  direction: SortDirection;
  query?: string;
}

interface UsePagedTracksArgs {
  query: string;
  sortConfig: SortConfig;
  defaultSortKey: string;
  fetchPage: (params: FetchTracksPageParams) => Promise<PageResponse<TrackResponse>>;
  pageSize?: number;
  filters?: TrackFilters;
  /** Bump to refetch from page 0 — e.g. PlayerProvider's `tracksVersion` after an upload/edit/delete. */
  refreshKey?: number;
}

/**
 * Shared infinite-scroll fetch/accumulate/reset machinery for a backend-driven track listing —
 * used by the main library, a genre's and a playlist's track list, against different endpoints.
 * A change to `query`, `sortConfig` or `refreshKey` resets back to page 0; `loadMore` appends the
 * next page. While any loaded track is still QUEUED/PROCESSING, the loaded window is polled so
 * status/playability updates show up without user action.
 */
export function usePagedTracks({ query, sortConfig, defaultSortKey, fetchPage, pageSize = DEFAULT_PAGE_SIZE, filters = EMPTY_FILTERS, refreshKey = 0 }: UsePagedTracksArgs) {
  const [tracks, setTracks] = useState<Track[]>([]);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Bumped on every fetch that should be authoritative (initial load, reset, sort/search change)
  // so a still-in-flight fetch for now-stale params can never clobber newer results.
  const requestIdRef = useRef(0);

  const sortBy = sortConfig?.key ?? defaultSortKey;
  const direction: SortDirection = sortConfig?.direction ?? "asc";

  // The .then/.catch/.finally chain must be written inline in the effect — delegating to a
  // called function (even one defined with useCallback) trips react-hooks/set-state-in-effect,
  // since it synchronously calls a state setter before the first await. `reset` below duplicates
  // this same body for manual/external use (e.g. after adding/removing a track).
  useEffect(() => {
    const requestId = ++requestIdRef.current;
    // Flipping isLoading back on for a query/sort-triggered refetch (not just the initial mount,
    // which already starts as loading) is a deliberate, unavoidable sync setState here.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsLoading(true);
    setError(null);

    fetchPage({ page: 0, size: pageSize, sortBy, direction, query: query || undefined, ...filters })
      .then((result) => {
        if (requestId !== requestIdRef.current) return;
        setTracks(result.content.map(mapTrackResponse));
        setPage(0);
        setHasMore(result.hasNext);
      })
      .catch(() => {
        if (requestId !== requestIdRef.current) return;
        setError("Could not load tracks from the server.");
      })
      .finally(() => {
        if (requestId !== requestIdRef.current) return;
        setIsLoading(false);
      });
    // refreshKey carries no value of its own — it's only here so bumping it retriggers the fetch.
  }, [fetchPage, pageSize, sortBy, direction, query, filters, refreshKey]);

  const reset = useCallback(() => {
    const requestId = ++requestIdRef.current;
    setIsLoading(true);
    setError(null);

    fetchPage({ page: 0, size: pageSize, sortBy, direction, query: query || undefined, ...filters })
      .then((result) => {
        if (requestId !== requestIdRef.current) return;
        setTracks(result.content.map(mapTrackResponse));
        setPage(0);
        setHasMore(result.hasNext);
      })
      .catch(() => {
        if (requestId !== requestIdRef.current) return;
        setError("Could not load tracks from the server.");
      })
      .finally(() => {
        if (requestId !== requestIdRef.current) return;
        setIsLoading(false);
      });
  }, [fetchPage, pageSize, sortBy, direction, query, filters]);

  const loadMore = useCallback(() => {
    if (isLoading || isLoadingMore || !hasMore) return;

    const requestId = requestIdRef.current;
    const nextPage = page + 1;
    setIsLoadingMore(true);

    fetchPage({ page: nextPage, size: pageSize, sortBy, direction, query: query || undefined, ...filters })
      .then((result) => {
        if (requestId !== requestIdRef.current) return;
        setTracks((prev) => [...prev, ...result.content.map(mapTrackResponse)]);
        setPage(nextPage);
        setHasMore(result.hasNext);
      })
      .catch(() => {
        if (requestId !== requestIdRef.current) return;
        setError("Could not load more tracks.");
      })
      .finally(() => {
        if (requestId !== requestIdRef.current) return;
        setIsLoadingMore(false);
      });
  }, [isLoading, isLoadingMore, hasMore, page, fetchPage, pageSize, sortBy, direction, query, filters]);

  /**
   * Silently re-fetches just the window of tracks already loaded (page 0 at `tracks.length`
   * items) and replaces them in place, without touching `page`/`hasMore` — for the QUEUED/
   * PROCESSING analysis-pipeline poll, which needs status updates on already-visible rows without
   * disturbing scroll position or how many further pages are available.
   */
  const refreshLoaded = useCallback(() => {
    const size = tracks.length || pageSize;
    const requestId = ++requestIdRef.current;

    fetchPage({ page: 0, size, sortBy, direction, query: query || undefined, ...filters })
      .then((result) => {
        if (requestId !== requestIdRef.current) return;
        setTracks(result.content.map(mapTrackResponse));
      })
      .catch(() => {
        // Silent — this is a background poll, not a user-initiated fetch.
      });
  }, [tracks.length, pageSize, fetchPage, sortBy, direction, query, filters]);

  // While any track is still QUEUED/PROCESSING, its status can change server-side (via the
  // analysis pipeline) without any user action here, so poll until nothing is left in flight.
  const hasActiveTracks = tracks.some(t => t.status === "QUEUED" || t.status === "PROCESSING");

  useEffect(() => {
    if (!hasActiveTracks) return;
    const interval = setInterval(refreshLoaded, ACTIVE_TRACKS_POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [hasActiveTracks, refreshLoaded]);

  return { tracks, setTracks, isLoading, isLoadingMore, error, hasMore, loadMore, reset, refreshLoaded };
}
