"use client";

import React, { useState } from "react";
import { usePlayer } from "@/components/providers/player-provider";

function AmbientImage({ coverUrl }: { coverUrl: string }) {
  const [error, setError] = useState(false);

  if (error) return null;

  return (
    <img
      src={coverUrl}
      alt=""
      onError={() => setError(true)}
      className="w-full h-full object-cover scale-110"
    />
  );
}

export function AmbientBackground() {
  const { currentTrack, ambientMode, isPlaying } = usePlayer();
  const coverUrl = currentTrack?.coverUrl;
  const isVisible = ambientMode && !!coverUrl;

  return (
    <div
      aria-hidden="true"
      className="fixed inset-0 pointer-events-none -z-10 overflow-hidden select-none bg-black"
    >
      <style>{`
        @keyframes ambient-drift {
          0% {
            transform: translate(-50%, -50%) rotate(0deg) scale(1.5);
          }
          50% {
            transform: translate(-50%, -50%) rotate(180deg) scale(1.85);
          }
          100% {
            transform: translate(-50%, -50%) rotate(360deg) scale(1.5);
          }
        }
        .ambient-spin-layer {
          will-change: transform;
          animation: ambient-drift 80s linear infinite;
        }
      `}</style>

      {/* Rotating blurred cover layer - expands beyond all edges */}
      <div
        className={`absolute top-1/2 left-1/2 w-[140vmax] h-[140vmax] min-w-[1300px] min-h-[1300px] transition-opacity duration-1000 ambient-spin-layer ${
          isVisible ? "opacity-85" : "opacity-0"
        }`}
        style={{
          filter: "blur(65px) saturate(200%) contrast(110%) brightness(0.95)",
          animationPlayState: isPlaying ? "running" : "paused",
        }}
      >
        {coverUrl && <AmbientImage key={coverUrl} coverUrl={coverUrl} />}
      </div>

      {/* Subtle darkening vignette overlay so texts, tables, and buttons stay crisp and readable */}
      <div
        className={`absolute inset-0 transition-opacity duration-1000 ${
          isVisible ? "opacity-100" : "opacity-0"
        }`}
        style={{
          background:
            "radial-gradient(ellipse at center, rgba(0,0,0,0.25) 0%, rgba(0,0,0,0.50) 60%, rgba(0,0,0,0.75) 100%)",
        }}
      />
    </div>
  );
}
