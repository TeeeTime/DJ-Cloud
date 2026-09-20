"use client";

import React, { useState } from "react";
import { usePlayer } from "@/components/providers/player-provider";

const AMBIENT_PALETTES = [
  { c1: "#7c3aed", c2: "#2563eb", c3: "#06b6d4", c4: "#db2777" }, // Violet / Cobalt / Cyan / Pink
  { c1: "#4f46e5", c2: "#9333ea", c3: "#e11d48", c4: "#0284c7" }, // Indigo / Purple / Rose / Sky
  { c1: "#0891b2", c2: "#059669", c3: "#3b82f6", c4: "#7c3aed" }, // Cyan / Emerald / Blue / Violet
  { c1: "#db2777", c2: "#ea580c", c3: "#9333ea", c4: "#06b6d4" }, // Pink / Orange / Purple / Cyan
  { c1: "#0d9488", c2: "#4338ca", c3: "#0284c7", c4: "#a855f7" }, // Teal / Deep Indigo / Sky / Purple
  { c1: "#e11d48", c2: "#7c3aed", c3: "#2563eb", c4: "#d97706" }, // Crimson / Violet / Cobalt / Amber
];

function getTrackPalette(trackId?: number, title?: string) {
  if (!trackId && !title) return AMBIENT_PALETTES[0];
  let hash = trackId ?? 0;
  if (title) {
    for (let i = 0; i < title.length; i++) {
      hash = (hash * 31 + title.charCodeAt(i)) | 0;
    }
  }
  const index = Math.abs(hash) % AMBIENT_PALETTES.length;
  return AMBIENT_PALETTES[index];
}

function AmbientCoverImage({ coverUrl }: { coverUrl: string }) {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);

  if (error) return null;

  return (
    <img
      src={coverUrl}
      alt=""
      onLoad={() => setLoaded(true)}
      onError={() => setError(true)}
      className={`absolute inset-0 w-full h-full object-cover scale-110 transition-opacity duration-1000 ${
        loaded ? "opacity-100" : "opacity-0"
      }`}
    />
  );
}

export function AmbientBackground() {
  const { currentTrack, ambientMode, isPlaying } = usePlayer();

  const coverUrl = currentTrack?.coverUrl;
  const trackId = currentTrack?.id;
  const isVisible = ambientMode && !!currentTrack;

  const palette = getTrackPalette(currentTrack?.id, currentTrack?.title);

  return (
    <div
      aria-hidden="true"
      className="fixed inset-0 pointer-events-none -z-10 overflow-hidden select-none bg-black"
    >
      <style>{`
        @keyframes ambient-drift {
          0% {
            transform: translate(-50%, -50%) rotate(0deg) scale(1.4);
          }
          50% {
            transform: translate(-50%, -50%) rotate(180deg) scale(1.75);
          }
          100% {
            transform: translate(-50%, -50%) rotate(360deg) scale(1.4);
          }
        }
        @keyframes ambient-pulse-slow {
          0%, 100% {
            opacity: 0.85;
            transform: scale(1);
          }
          50% {
            opacity: 1;
            transform: scale(1.08);
          }
        }
        .ambient-spin-layer {
          will-change: transform;
          animation: ambient-drift 80s linear infinite;
        }
        .ambient-generative-orb {
          filter: blur(80px);
          will-change: transform, opacity;
          animation: ambient-pulse-slow 12s ease-in-out infinite alternate;
        }
      `}</style>

      {/* Ambient Canvas Container: spreads beyond screen boundaries */}
      <div
        className={`absolute top-1/2 left-1/2 w-[140vmax] h-[140vmax] min-w-[1300px] min-h-[1300px] transition-opacity duration-1000 ambient-spin-layer ${
          isVisible ? "opacity-90" : "opacity-0"
        }`}
        style={{
          filter: "blur(65px) saturate(210%) contrast(115%) brightness(0.95)",
          animationPlayState: isPlaying ? "running" : "paused",
        }}
      >
        {/* Generative Harmonic Gradient Mesh (Always available as background / fallback for coverless tracks) */}
        <div className="absolute inset-0 w-full h-full">
          {/* Orb 1: Top Left */}
          <div
            className="ambient-generative-orb absolute w-[55%] h-[55%] -top-[10%] -left-[10%] rounded-full transition-colors duration-1000"
            style={{
              background: `radial-gradient(circle, ${palette.c1} 0%, transparent 70%)`,
            }}
          />
          {/* Orb 2: Bottom Right */}
          <div
            className="ambient-generative-orb absolute w-[60%] h-[60%] -bottom-[10%] -right-[10%] rounded-full transition-colors duration-1000"
            style={{
              background: `radial-gradient(circle, ${palette.c2} 0%, transparent 70%)`,
              animationDelay: "-4s",
            }}
          />
          {/* Orb 3: Center Accent */}
          <div
            className="ambient-generative-orb absolute w-[50%] h-[50%] top-[25%] left-[25%] rounded-full transition-colors duration-1000"
            style={{
              background: `radial-gradient(circle, ${palette.c3} 0%, transparent 65%)`,
              animationDelay: "-8s",
            }}
          />
          {/* Orb 4: Counter Accent */}
          <div
            className="ambient-generative-orb absolute w-[45%] h-[45%] top-[10%] right-[10%] rounded-full transition-colors duration-1000"
            style={{
              background: `radial-gradient(circle, ${palette.c4} 0%, transparent 70%)`,
              animationDelay: "-2s",
            }}
          />
        </div>

        {/* Real Cover Image Layer (Fades in over generative mesh when artwork is available and successfully loaded) */}
        {coverUrl && (
          <AmbientCoverImage key={`${trackId}-${coverUrl}`} coverUrl={coverUrl} />
        )}
      </div>

      {/* Subtle darkening vignette overlay so texts, tables, and buttons stay crisp and readable */}
      <div
        className={`absolute inset-0 transition-opacity duration-1000 ${
          isVisible ? "opacity-100" : "opacity-0"
        }`}
        style={{
          background:
            "radial-gradient(ellipse at center, rgba(0,0,0,0.30) 0%, rgba(0,0,0,0.55) 60%, rgba(0,0,0,0.85) 100%)",
        }}
      />
    </div>
  );
}
