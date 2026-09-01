"use client";

import { useState } from "react";
import { Music2 } from "lucide-react";
import { Track } from "@/lib/data";

export function StatusBadge({ status }: { status: Track["status"] }) {
  if (status === 'READY') return <span className="text-zinc-300 border border-zinc-700 bg-zinc-800 px-1.5 py-0.5 rounded">Ready</span>;
  if (status === 'PROCESSING') return <span className="text-zinc-500 border border-zinc-800 px-1.5 py-0.5 rounded flex items-center gap-1.5 w-fit"><span className="w-1 h-1 rounded-full bg-zinc-400 animate-pulse"></span>Proc</span>;
  if (status === 'QUEUED') return <span className="text-zinc-500 border border-zinc-800 px-1.5 py-0.5 rounded w-fit">Queued</span>;
  return <span className="text-zinc-600 border border-zinc-900 px-1.5 py-0.5 rounded line-through">Failed</span>;
}

export function TrackThumbnail({ src }: { src: string }) {
  const [error, setError] = useState(false);

  if (error) {
    return (
      <div className="w-8 h-8 rounded bg-zinc-900 border border-zinc-800 flex items-center justify-center shrink-0">
        <Music2 className="w-3.5 h-3.5 text-zinc-700" />
      </div>
    );
  }

  return (
    <img
      src={src}
      alt=""
      onError={() => setError(true)}
      className="w-8 h-8 rounded object-cover border border-zinc-800 shrink-0"
    />
  );
}
