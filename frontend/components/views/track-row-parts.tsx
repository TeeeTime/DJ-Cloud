"use client";

import { useState } from "react";
import { Music2 } from "lucide-react";
import { Track, buildCoverUrl } from "@/lib/data";
import { authApi } from "@/lib/api";
import { setMediaToken } from "@/lib/media-token";
import { useAuth } from "@/components/providers/auth-provider";

export function StatusBadge({ status }: { status: Track["status"] }) {
  if (status === 'READY') return <span className="text-zinc-300 border border-zinc-700 bg-zinc-800 px-1.5 py-0.5 rounded">Ready</span>;
  if (status === 'PROCESSING') return <span className="text-zinc-500 border border-zinc-800 px-1.5 py-0.5 rounded flex items-center gap-1.5 w-fit"><span className="w-1 h-1 rounded-full bg-zinc-400 animate-pulse"></span>Proc</span>;
  if (status === 'QUEUED') return <span className="text-zinc-500 border border-zinc-800 px-1.5 py-0.5 rounded w-fit">Queued</span>;
  return <span className="text-zinc-600 border border-zinc-900 px-1.5 py-0.5 rounded line-through">Failed</span>;
}

export function TrackThumbnail({ src, trackId }: { src: string; trackId: number }) {
  const { token: authToken } = useAuth();
  const [error, setError] = useState(false);
  const [retriedSrc, setRetriedSrc] = useState<string | null>(null);
  const [hasRetried, setHasRetried] = useState(false);

  // A cover that previously 404'd must be re-attempted once `src` actually changes (e.g. after
  // editing the cover) — otherwise this instance stays stuck on the fallback icon forever.
  const [prevSrc, setPrevSrc] = useState(src);
  if (src !== prevSrc) {
    setPrevSrc(src);
    setError(false);
    setRetriedSrc(null);
    setHasRetried(false);
  }

  // The media token embedded in `src` can be stale — e.g. the track list rendered before the
  // initial media-token fetch resolved, or a long-idle session's token has since expired. Mint a
  // fresh one and retry once before giving up and showing the fallback icon.
  const handleError = async () => {
    if (hasRetried || !authToken) {
      setError(true);
      return;
    }
    setHasRetried(true);
    try {
      const { token } = await authApi.mediaToken(authToken);
      setMediaToken(token);
      setRetriedSrc(buildCoverUrl(trackId));
    } catch {
      setError(true);
    }
  };

  if (error) {
    return (
      <div className="w-8 h-8 rounded bg-zinc-900 border border-zinc-800 flex items-center justify-center shrink-0">
        <Music2 className="w-3.5 h-3.5 text-zinc-700" />
      </div>
    );
  }

  return (
    <img
      src={retriedSrc ?? src}
      alt=""
      onError={() => (retriedSrc ? setError(true) : handleError())}
      className="w-8 h-8 rounded object-cover border border-zinc-800 shrink-0"
    />
  );
}
