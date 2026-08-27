"use client";

import React, { useEffect, useState } from "react";
import { tracksApi, QueueStatus, AnalysisStep } from "@/lib/api";
import { usePlayer } from "@/components/providers/player-provider";

const POLL_INTERVAL_MS = 2500;
const HOVER_PREVIEW_COUNT = 5;

const STEP_LABELS: Record<AnalysisStep, string> = {
  PREVIEW_GENERATION: "Generating preview",
  BPM_ANALYSIS: "Analyzing BPM",
  KEY_ANALYSIS: "Detecting key",
};

const STEP_ORDER: AnalysisStep[] = ["PREVIEW_GENERATION", "BPM_ANALYSIS", "KEY_ANALYSIS"];

export function QueueStatusWidget() {
  const { tracks } = usePlayer();
  const [status, setStatus] = useState<QueueStatus | null>(null);

  useEffect(() => {
    const poll = () => {
      tracksApi.queue()
        .then(setStatus)
        // Transient failure: keep showing the last known state rather than clearing it —
        // a failed poll isn't evidence the queue is actually empty.
        .catch(() => {});
    };
    poll();
    const interval = setInterval(poll, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, []);

  if (!status || !status.processing) {
    return null;
  }

  const { trackId, step } = status.processing;
  const stepIndex = STEP_ORDER.indexOf(step);
  const progressPercent = ((stepIndex + 1) / STEP_ORDER.length) * 100;

  const titleFor = (id: number) => tracks.find(t => t.id === id)?.title ?? `Track #${id}`;

  const upNext = status.queued.slice(0, HOVER_PREVIEW_COUNT);
  const extraCount = status.queued.length - upNext.length;

  return (
    <div className="group relative flex flex-col gap-1 w-40 shrink-0">
      {status.queued.length > 0 && (
        <div className="absolute bottom-full right-0 mb-2 hidden group-hover:block w-56 bg-zinc-900 border border-zinc-800 rounded-md shadow-lg p-2 z-10">
          <p className="text-[10px] uppercase tracking-wide text-zinc-500 px-1 pb-1">Up next</p>
          <ul className="space-y-0.5">
            {upNext.map(id => (
              <li key={id} className="text-xs text-zinc-300 truncate px-1 py-0.5">{titleFor(id)}</li>
            ))}
          </ul>
          {extraCount > 0 && (
            <p className="text-[10px] text-zinc-500 px-1 pt-1">+{extraCount} more</p>
          )}
        </div>
      )}

      <div className="flex items-center justify-between gap-2 text-xs">
        <span className="text-zinc-300 truncate" title={titleFor(trackId)}>{titleFor(trackId)}</span>
        {status.queued.length > 0 && (
          <span className="text-zinc-500 flex items-center gap-1 shrink-0">
            <span className="w-1 h-1 rounded-full bg-zinc-400 animate-pulse" />
            +{status.queued.length}
          </span>
        )}
      </div>
      <span className="text-[10px] text-zinc-500 truncate">{STEP_LABELS[step]}</span>
      <div className="h-1.5 w-full bg-zinc-900 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full bg-white transition-all duration-1000 ease-out"
          style={{ width: `${progressPercent}%` }}
        />
      </div>
    </div>
  );
}
