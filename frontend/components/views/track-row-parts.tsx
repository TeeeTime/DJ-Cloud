"use client";

import { useState } from "react";
import { Music2 } from "lucide-react";
import { Track } from "@/lib/data";
import { useCover } from "@/lib/cover-cache";

export function StatusBadge({ status }: { status: Track["status"] }) {
  if (status === 'READY') return <span className="text-zinc-300 border border-zinc-700 bg-zinc-800 px-1.5 py-0.5 rounded">Ready</span>;
  if (status === 'PROCESSING') return <span className="text-zinc-500 border border-zinc-800 px-1.5 py-0.5 rounded flex items-center gap-1.5 w-fit"><span className="w-1 h-1 rounded-full bg-zinc-400 animate-pulse"></span>Proc</span>;
  if (status === 'QUEUED') return <span className="text-zinc-500 border border-zinc-800 px-1.5 py-0.5 rounded w-fit">Queued</span>;
  return <span className="text-zinc-600 border border-zinc-900 px-1.5 py-0.5 rounded line-through">Failed</span>;
}

export function TrackThumbnail({ trackId, coverVersion }: { trackId: number; coverVersion: number }) {
  // Displayed at 32px — 64 keeps it sharp on high-DPI screens.
  const src = useCover(trackId, coverVersion, 64);
  const [loadedSrc, setLoadedSrc] = useState<string | null>(null);

  // The fallback icon is always the base layer, not just an on-error state — that way there's
  // never a gap (pending, stuck, or otherwise not-yet-resolved) where neither the icon nor the
  // real cover is visible. The real <img> just fades in on top once it actually finishes loading.
  return (
    <div className="relative w-8 h-8 rounded bg-zinc-900 border border-zinc-800 flex items-center justify-center shrink-0 overflow-hidden">
      <Music2 className="w-3.5 h-3.5 text-zinc-700" />
      {src && (
        <img
          src={src}
          alt=""
          decoding="async"
          onLoad={() => setLoadedSrc(src)}
          className={`absolute inset-0 w-8 h-8 object-cover transition-opacity duration-200 ${loadedSrc === src ? "opacity-100" : "opacity-0"}`}
        />
      )}
    </div>
  );
}
