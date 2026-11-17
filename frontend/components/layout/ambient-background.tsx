"use client";

import React, { useEffect, useRef, useState } from "react";
import { usePlayer } from "@/components/providers/player-provider";
import { useAuth } from "@/components/providers/auth-provider";
import { buildCoverUrl } from "@/lib/data";
import { authApi } from "@/lib/api";
import { setMediaToken } from "@/lib/media-token";

const AMBIENT_PALETTES = [
  { c1: "#7c3aed", c2: "#2563eb", c3: "#06b6d4", c4: "#db2777" }, // Violet / Cobalt / Cyan / Pink
  { c1: "#4f46e5", c2: "#9333ea", c3: "#e11d48", c4: "#0284c7" }, // Indigo / Purple / Rose / Sky
  { c1: "#0891b2", c2: "#059669", c3: "#3b82f6", c4: "#7c3aed" }, // Cyan / Emerald / Blue / Violet
  { c1: "#db2777", c2: "#ea580c", c3: "#9333ea", c4: "#06b6d4" }, // Pink / Orange / Purple / Cyan
  { c1: "#0d9488", c2: "#4338ca", c3: "#0284c7", c4: "#a855f7" }, // Teal / Deep Indigo / Sky / Purple
  { c1: "#e11d48", c2: "#7c3aed", c3: "#2563eb", c4: "#d97706" }, // Crimson / Violet / Cobalt / Amber
];

// Matches the opacity transition below — how long the layer stays mounted after ambient mode is
// switched off, so it can fade out before being torn down.
const FADE_MS = 1000;

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

/**
 * Bakes the blurred, color-boosted look into a tiny canvas once, instead of running a live CSS
 * `filter: blur()` on a ~2700px rotating layer every frame. CSS then stretches the small canvas up
 * to full size, and that upscale itself adds the remaining softness for free. Center-crops to a
 * square, same framing `object-cover` gave on the square container.
 */
function drawBlurredCover(canvas: HTMLCanvasElement, img: HTMLImageElement): boolean {
  const ctx = canvas.getContext("2d");
  if (!ctx || !img.naturalWidth || !img.naturalHeight) return false;

  // Canvas `filter` isn't available everywhere (notably Safari) — there, a much smaller canvas
  // makes the upscale do all of the blurring instead.
  const supportsFilter = "filter" in ctx;
  const size = supportsFilter ? 128 : 24;
  // Drawn slightly oversized so the blur doesn't pull transparent pixels in at the edges.
  const pad = supportsFilter ? 8 : 0;

  canvas.width = size;
  canvas.height = size;

  const side = Math.min(img.naturalWidth, img.naturalHeight);
  const sx = (img.naturalWidth - side) / 2;
  const sy = (img.naturalHeight - side) / 2;

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  if (supportsFilter) {
    ctx.filter = "blur(3px) saturate(210%) contrast(115%) brightness(0.95)";
  }
  ctx.drawImage(img, sx, sy, side, side, -pad, -pad, size + pad * 2, size + pad * 2);
  return true;
}

function AmbientCoverImage({ coverUrl, trackId }: { coverUrl: string; trackId: number }) {
  const { token: authToken } = useAuth();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let retried = false;
    const img = new Image();
    img.decoding = "async";

    const release = () => {
      img.onload = null;
      img.onerror = null;
      img.removeAttribute("src");
    };

    img.onload = () => {
      if (cancelled) return;
      const canvas = canvasRef.current;
      const ok = !!canvas && drawBlurredCover(canvas, img);
      // The full-size source isn't needed anymore once it's baked into the small canvas.
      release();
      if (ok) setLoaded(true);
      else setError(true);
    };

    // The media token embedded in `coverUrl` can be stale — e.g. this rendered before the initial
    // media-token fetch resolved (the "first batch on app boot" race), or a long-idle session's
    // token has since expired. Mint a fresh one and retry once before giving up.
    img.onerror = async () => {
      if (cancelled) return;
      if (retried || !authToken) {
        release();
        setError(true);
        return;
      }
      retried = true;
      try {
        const { token } = await authApi.mediaToken(authToken);
        if (cancelled) return;
        setMediaToken(token);
        img.src = buildCoverUrl(trackId);
      } catch {
        if (cancelled) return;
        release();
        setError(true);
      }
    };

    img.src = coverUrl;

    return () => {
      cancelled = true;
      release();
    };
  }, [coverUrl, trackId, authToken]);

  if (error) return null;

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className={`absolute inset-0 w-full h-full scale-110 transition-opacity duration-1000 ${
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

  // The heavy layer is only mounted while ambient mode is actually showing (plus the fade-out
  // afterwards) — merely hiding it with opacity kept its huge GPU layers allocated and its
  // animations ticking the whole time, even with ambient mode off.
  const [layerMounted, setLayerMounted] = useState(isVisible);
  if (isVisible && !layerMounted) {
    setLayerMounted(true);
  }

  useEffect(() => {
    if (isVisible || !layerMounted) return;
    const timeout = setTimeout(() => setLayerMounted(false), FADE_MS);
    return () => clearTimeout(timeout);
  }, [isVisible, layerMounted]);

  const palette = getTrackPalette(currentTrack?.id, currentTrack?.title);

  return (
    <div
      aria-hidden="true"
      className="fixed inset-0 pointer-events-none -z-10 overflow-hidden select-none bg-black"
    >
      {layerMounted && (
        <>
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
            @keyframes ambient-fade-in {
              from {
                opacity: 0;
              }
            }
            .ambient-fade-layer {
              animation: ambient-fade-in ${FADE_MS}ms ease;
            }
            /* No filter on this layer or anything inside it: a transform-only animation on
               already-rasterized content stays on the compositor and costs almost nothing per
               frame. The blur is baked into the cover canvas, and the orbs' radial gradients are
               already soft on their own. */
            .ambient-spin-layer {
              will-change: transform;
              animation: ambient-drift 80s linear infinite;
            }
          `}</style>

          <div
            className={`absolute inset-0 ambient-fade-layer transition-opacity duration-1000 ${
              isVisible ? "opacity-100" : "opacity-0"
            }`}
          >
            {/* Ambient Canvas Container: spreads beyond screen boundaries */}
            <div
              className="absolute top-1/2 left-1/2 w-[140vmax] h-[140vmax] min-w-[1300px] min-h-[1300px] opacity-90 ambient-spin-layer"
              style={{ animationPlayState: isPlaying ? "running" : "paused" }}
            >
              {/* Generative Harmonic Gradient Mesh (Always available as background / fallback for coverless tracks) */}
              <div className="absolute inset-0 w-full h-full">
                {/* Orb 1: Top Left */}
                <div
                  className="absolute w-[55%] h-[55%] -top-[10%] -left-[10%] rounded-full"
                  style={{ background: `radial-gradient(circle, ${palette.c1} 0%, transparent 70%)` }}
                />
                {/* Orb 2: Bottom Right */}
                <div
                  className="absolute w-[60%] h-[60%] -bottom-[10%] -right-[10%] rounded-full"
                  style={{ background: `radial-gradient(circle, ${palette.c2} 0%, transparent 70%)` }}
                />
                {/* Orb 3: Center Accent */}
                <div
                  className="absolute w-[50%] h-[50%] top-[25%] left-[25%] rounded-full"
                  style={{ background: `radial-gradient(circle, ${palette.c3} 0%, transparent 65%)` }}
                />
                {/* Orb 4: Counter Accent */}
                <div
                  className="absolute w-[45%] h-[45%] top-[10%] right-[10%] rounded-full"
                  style={{ background: `radial-gradient(circle, ${palette.c4} 0%, transparent 70%)` }}
                />
              </div>

              {/* Real Cover Image Layer (Fades in over generative mesh when artwork is available and successfully loaded) */}
              {coverUrl && trackId !== undefined && (
                <AmbientCoverImage key={`${trackId}-${coverUrl}`} coverUrl={coverUrl} trackId={trackId} />
              )}
            </div>

            {/* Subtle darkening vignette overlay so texts, tables, and buttons stay crisp and readable */}
            <div
              className="absolute inset-0"
              style={{
                background:
                  "radial-gradient(ellipse at center, rgba(0,0,0,0.30) 0%, rgba(0,0,0,0.55) 60%, rgba(0,0,0,0.85) 100%)",
              }}
            />
          </div>
        </>
      )}
    </div>
  );
}
