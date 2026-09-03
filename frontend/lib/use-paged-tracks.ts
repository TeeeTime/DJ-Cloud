"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { PageResponse, TrackResponse } from "@/lib/api";
import { Track, mapTrackResponse } from "@/lib/data";

export type SortDirection = "asc" | "desc";
export type SortConfig = { key: string; direction: SortDirection } | null;

const DEFAULT_PAGE_SIZE = 30;

export interface FetchTracksPageParams {
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
}

/**
 * Shared infinite-scroll fetch/accumulate/reset machinery for a backend-driven track listing —
 * used by both the main library and a single playlist's track list, against different endpoints.
 * A change to `query` or `sortConfig` resets back to page 0; `loadMore` appends the next page.
 */
export function usePagedTracks({ query, sortConfig, defaultSortKey, fetchPage, pageSize = DEFAULT_PAGE_SIZE }: UsePagedTracksArgs) {
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

    fetchPage({ page: 0, size: pageSize, sortBy, direction, query: query || undefined })
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
  }, [fetchPage, pageSize, sortBy, direction, query]);

  const reset = useCallback(() => {
    const requestId = ++requestIdRef.current;
    setIsLoading(true);
    setError(null);

    fetchPage({ page: 0, size: pageSize, sortBy, direction, query: query || undefined })
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
  }, [fetchPage, pageSize, sortBy, direction, query]);

  const loadMore = useCallback(() => {
    if (isLoading || isLoadingMore || !hasMore) return;

    const requestId = requestIdRef.current;
    const nextPage = page + 1;
    setIsLoadingMore(true);

    fetchPage({ page: nextPage, size: pageSize, sortBy, direction, query: query || undefined })
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
  }, [isLoading, isLoadingMore, hasMore, page, fetchPage, pageSize, sortBy, direction, query]);

  /**
   * Silently re-fetches just the window of tracks already loaded (page 0 at `tracks.length`
   * items) and replaces them in place, without touching `page`/`hasMore` — for the QUEUED/
   * PROCESSING analysis-pipeline poll, which needs status updates on already-visible rows without
   * disturbing scroll position or how many further pages are available.
   */
  const refreshLoaded = useCallback(() => {
    const size = tracks.length || pageSize;
    const requestId = ++requestIdRef.current;

    fetchPage({ page: 0, size, sortBy, direction, query: query || undefined })
      .then((result) => {
        if (requestId !== requestIdRef.current) return;
        setTracks(result.content.map(mapTrackResponse));
      })
      .catch(() => {
        // Silent — this is a background poll, not a user-initiated fetch.
      });
  }, [tracks.length, pageSize, fetchPage, sortBy, direction, query]);

  return { tracks, isLoading, isLoadingMore, error, hasMore, loadMore, reset, refreshLoaded };
}
