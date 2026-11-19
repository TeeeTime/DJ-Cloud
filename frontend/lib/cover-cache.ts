"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { CoverSize, tracksApi } from "@/lib/api";
import { useAuth } from "@/components/providers/auth-provider";

/**
 * Loads cover art through one shared, session-wide cache.
 *
 * Covers are fetched with the session's Authorization header rather than as an <img src> carrying the
 * rotating media token. That keeps each URL stable per (track, size, coverVersion), so the backend can
 * mark it immutable and the browser's HTTP cache actually gets reused, across views and across visits.
 * The fetched bytes are handed to <img> as object URLs. A small in-memory LRU on top makes repeat
 * renders (switching views, scrolling back) instant without any request at all.
 *
 * `undefined` = still loading, `null` = no cover (or it failed to load), string = object URL to show.
 */
export type CoverResult = string | null;

const MAX_ENTRIES = 500;

const entries = new Map<string, CoverResult>();
const inFlight = new Map<string, Promise<CoverResult>>();

// Cover versions this tab knows to be newer than what some already-loaded Track objects say — set
// right after this user changes a cover, so every view (bottom player, ambient background, lists that
// haven't refetched yet) switches to the new image immediately. Other users pick the change up the
// next time their track data is fetched, since the backend then sends the new coverVersion.
const versionOverrides = new Map<number, number>();
let overridesRevision = 0;
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getOverridesRevision() {
  return overridesRevision;
}

/** Call with the version returned by PUT/DELETE /api/tracks/{id}/cover. */
export function noteCoverChanged(trackId: number, newVersion: number) {
  versionOverrides.set(trackId, Math.max(newVersion, versionOverrides.get(trackId) ?? 0));
  overridesRevision++;
  listeners.forEach((listener) => listener());
}

function effectiveVersion(trackId: number, version: number) {
  return Math.max(version, versionOverrides.get(trackId) ?? 0);
}

function cacheKey(trackId: number, size: CoverSize, version: number) {
  return `${trackId}:${size}:${version}`;
}

function remember(key: string, value: CoverResult) {
  entries.delete(key);
  entries.set(key, value);
  while (entries.size > MAX_ENTRIES) {
    const oldestKey = entries.keys().next().value as string;
    const oldest = entries.get(oldestKey);
    entries.delete(oldestKey);
    // Safe for an <img> that already loaded it — it keeps its decoded image; only a brand-new
    // <img> would fail, and new renders read from the cache (and re-fetch) instead.
    if (oldest) URL.revokeObjectURL(oldest);
  }
}

/** Cached value (marking it recently used), or undefined if it hasn't been loaded yet. */
function peek(key: string): CoverResult | undefined {
  if (!entries.has(key)) return undefined;
  const value = entries.get(key) as CoverResult;
  entries.delete(key);
  entries.set(key, value);
  return value;
}

async function fetchCover(
  trackId: number,
  size: CoverSize,
  version: number,
  authToken: string,
  cache: RequestCache
): Promise<CoverResult> {
  const res = await fetch(tracksApi.coverUrl(trackId, size, version), {
    headers: { Authorization: `Bearer ${authToken}` },
    cache,
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Cover request failed with ${res.status}`);
  return URL.createObjectURL(await res.blob());
}

function loadCover(trackId: number, size: CoverSize, version: number, authToken: string): Promise<CoverResult> {
  const key = cacheKey(trackId, size, version);
  const pending = inFlight.get(key);
  if (pending) return pending;

  const promise = fetchCover(trackId, size, version, authToken, "default")
    .then((value) => {
      remember(key, value);
      return value;
    })
    .finally(() => inFlight.delete(key));
  inFlight.set(key, promise);
  return promise;
}

/**
 * The cover for a track at one of the backend's fixed sizes. Pick the smallest size that's at least
 * ~2x the displayed size (for high-DPI screens); sharing sizes between views also shares the cache.
 */
export function useCover(trackId: number | null | undefined, coverVersion: number, size: CoverSize): CoverResult | undefined {
  const { token } = useAuth();
  // Re-render when this tab changes some cover, so the effective version below is re-read.
  useSyncExternalStore(subscribe, getOverridesRevision, getOverridesRevision);

  const version = trackId == null ? 0 : effectiveVersion(trackId, coverVersion);
  const key = trackId == null ? null : cacheKey(trackId, size, version);

  const [resolved, setResolved] = useState<{ key: string | null; value: CoverResult | undefined }>(() => ({
    key,
    value: key ? peek(key) : undefined,
  }));

  // Adjusting state when the key changes, during render rather than in an effect (same idiom as
  // elsewhere in the app), so a cached cover shows on the very first paint for the new key.
  let value = resolved.value;
  if (resolved.key !== key) {
    value = key ? peek(key) : undefined;
    setResolved({ key, value });
  }

  useEffect(() => {
    if (trackId == null || !key || !token || entries.has(key)) return;
    let cancelled = false;
    loadCover(trackId, size, version, token).then(
      (loaded) => {
        if (!cancelled) setResolved({ key, value: loaded });
      },
      () => {
        // Not cached: a later mount (or a token refresh) gets to try again.
        if (!cancelled) setResolved({ key, value: null });
      }
    );
    return () => {
      cancelled = true;
    };
  }, [trackId, size, version, key, token]);

  return value;
}

/**
 * Like useCover, but always asks the server for the current cover (bypassing both caches), for the
 * track edit dialog: it must show what's actually stored right now, even if this tab's track data is
 * older than another user's cover change. The result is private to the caller and released on unmount.
 */
export function useFreshCover(
  trackId: number | null | undefined,
  coverVersion: number,
  size: CoverSize
): CoverResult | undefined {
  const { token } = useAuth();
  const [resolved, setResolved] = useState<{ trackId: number | null; value: CoverResult | undefined }>({
    trackId: null,
    value: undefined,
  });

  const id = trackId ?? null;
  let value = resolved.value;
  if (resolved.trackId !== id) {
    value = undefined;
    setResolved({ trackId: id, value: undefined });
  }

  useEffect(() => {
    if (id == null || !token) return;
    let cancelled = false;
    let objectUrl: string | null = null;
    // "no-cache" makes the browser re-fetch regardless of the version in the URL, so this shows the
    // current server image even if `coverVersion` is stale; the browser cache then also holds the
    // current image under that URL, which is only ever more up to date than what it had.
    const version = effectiveVersion(id, coverVersion);
    fetchCover(id, size, version, token, "no-cache").then(
      (loaded) => {
        objectUrl = loaded;
        if (cancelled) {
          if (loaded) URL.revokeObjectURL(loaded);
          return;
        }
        setResolved({ trackId: id, value: loaded });
      },
      () => {
        if (!cancelled) setResolved({ trackId: id, value: null });
      }
    );
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [id, coverVersion, size, token]);

  return value;
}
