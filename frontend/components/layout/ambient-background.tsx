"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { usePlayer } from "@/components/providers/player-provider";
import { useCover } from "@/lib/cover-cache";
import type { Track } from "@/lib/data";

const AMBIENT_PALETTES = [
  { c1: "#7c3aed", c2: "#2563eb", c3: "#06b6d4", c4: "#db2777" }, // Violet / Cobalt / Cyan / Pink
  { c1: "#4f46e5", c2: "#9333ea", c3: "#e11d48", c4: "#0284c7" }, // Indigo / Purple / Rose / Sky
  { c1: "#0891b2", c2: "#059669", c3: "#3b82f6", c4: "#7c3aed" }, // Cyan / Emerald / Blue / Violet
  { c1: "#db2777", c2: "#ea580c", c3: "#9333ea", c4: "#06b6d4" }, // Pink / Orange / Purple / Cyan
  { c1: "#0d9488", c2: "#4338ca", c3: "#0284c7", c4: "#a855f7" }, // Teal / Deep Indigo / Sky / Purple
  { c1: "#e11d48", c2: "#7c3aed", c3: "#2563eb", c4: "#d97706" }, // Crimson / Violet / Cobalt / Amber
];

// Matches the opacity transitions below — how long the layer stays mounted after ambient mode is
// switched off (so it can fade out), and how long an outgoing track's scene is kept underneath the
// incoming one.
const FADE_MS = 1000;

// If a track's cover takes longer than this to arrive, its scene is shown anyway (orbs first, cover
// fading in once it's there) instead of keeping the previous track's visuals around indefinitely.
const READY_TIMEOUT_MS = 4000;

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

function AmbientCoverImage({
  src,
  fadeIn,
  onDrawn,
}: {
  src: string | undefined;
  fadeIn: boolean;
  onDrawn: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // Decided once at mount: a cover that's part of a scene's initial look appears instantly (the
  // whole scene fades in instead); only a cover arriving after its scene is already showing (added
  // while the track plays, or slower than READY_TIMEOUT_MS) fades in on its own.
  const [animate] = useState(fadeIn);
  const [hasDrawn, setHasDrawn] = useState(false);

  useEffect(() => {
    if (!src) return;
    let cancelled = false;
    const img = new Image();
    img.decoding = "async";
    img.onload = () => {
      const canvas = canvasRef.current;
      if (!cancelled && canvas && drawBlurredCover(canvas, img)) {
        setHasDrawn(true);
        onDrawn();
      }
    };
    img.src = src;
    return () => {
      cancelled = true;
      img.onload = null;
    };
  }, [src, onDrawn]);

  // Stays mounted while a changed cover loads, so the previous drawing remains until it's replaced.
  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className={`absolute inset-0 w-full h-full scale-110 ${animate ? "transition-opacity duration-1000" : ""} ${
        hasDrawn ? "opacity-100" : "opacity-0"
      }`}
    />
  );
}

type SceneInfo = { key: number; trackId: number; title: string; coverVersion: number };

/**
 * Everything one track looks like: its palette orbs plus, if it has one, its blurred cover. Stays fully
 * transparent until it's "ready" (cover drawn, or known to have none), then fades in over the previous
 * track's scene, so there's never an in-between flash of the fallback palette.
 */
function AmbientScene({ scene, onReady }: { scene: SceneInfo; onReady: (key: number) => void }) {
  const { key, trackId, title, coverVersion } = scene;
  const palette = getTrackPalette(trackId, title);
  // 128px is plenty: it's drawn into a 128px canvas and heavily blurred anyway. Same size as the
  // bottom player's cover, so this is usually already cached.
  const src = useCover(trackId, coverVersion, 128);

  const [coverDrawn, setCoverDrawn] = useState(false);
  const [timedOut, setTimedOut] = useState(false);
  if (src === null && coverDrawn) {
    // Cover removed while playing — the canvas unmounts, a later new cover starts from scratch.
    setCoverDrawn(false);
  }
  const ready = src === null || coverDrawn || timedOut;

  useEffect(() => {
    if (ready) return;
    const timeout = setTimeout(() => setTimedOut(true), READY_TIMEOUT_MS);
    return () => clearTimeout(timeout);
  }, [ready]);

  useEffect(() => {
    if (ready) onReady(key);
  }, [ready, key, onReady]);

  const handleDrawn = useCallback(() => setCoverDrawn(true), []);

  return (
    // A keyframe animation rather than an opacity transition: a scene can be ready on its very first
    // render (a coverless track whose 404 is already cached), and a transition has no "from" value on
    // a freshly mounted element, so it would just pop in. The animation starts whenever the class is
    // applied, whether that's at mount or later.
    // bg-black makes the scene opaque: the orbs fade out to transparent, so without it the previous
    // scene would keep shining through between them and then vanish in one frame once it's removed.
    <div className={`absolute inset-0 bg-black ${ready ? "ambient-fade-layer" : "opacity-0"}`}>
      {/* Generative Harmonic Gradient Mesh (background, and the whole look for coverless tracks) */}
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

      {/* Real cover, drawn over the mesh */}
      {src !== null && <AmbientCoverImage src={src} fadeIn={ready} onDrawn={handleDrawn} />}
    </div>
  );
}

type ScenesState = { scenes: SceneInfo[]; shownKey: number | null; nextKey: number };

function sceneFor(track: Track, key: number): SceneInfo {
  return { key, trackId: track.id, title: track.title, coverVersion: track.coverVersion };
}

/**
 * Stacks scenes so a track change cross-fades from the old track's finished look straight to the new
 * one's. The previous scene stays underneath until the new one has fully faded in, then gets dropped,
 * so at most two scenes exist at once (only during a transition). Mounted together with the ambient
 * layer, so its state starts fresh each time ambient mode turns on.
 */
function AmbientScenes({ track }: { track: Track | null }) {
  const [state, setState] = useState<ScenesState>(() => ({
    scenes: track ? [sceneFor(track, 0)] : [],
    shownKey: null,
    nextKey: 1,
  }));

  // Track changed: keep everything up to the scene currently shown, drop a still-pending one (skipped
  // before it was ready), and put the new track's scene on top. Adjusted during render, like elsewhere.
  const latest = state.scenes[state.scenes.length - 1];
  if (track && track.id !== latest?.trackId) {
    const shownIndex = state.scenes.findIndex((s) => s.key === state.shownKey);
    setState({
      scenes: [...state.scenes.slice(0, shownIndex + 1), sceneFor(track, state.nextKey)],
      shownKey: state.shownKey,
      nextKey: state.nextKey + 1,
    });
  }

  const handleReady = useCallback((key: number) => {
    setState((s) => (s.shownKey === key ? s : { ...s, shownKey: key }));
  }, []);

  // Once the newly shown scene has finished fading in, the ones beneath it are fully hidden.
  useEffect(() => {
    if (state.shownKey === null) return;
    const shownKey = state.shownKey;
    const timeout = setTimeout(() => {
      setState((s) => {
        const index = s.scenes.findIndex((scene) => scene.key === shownKey);
        return index > 0 ? { ...s, scenes: s.scenes.slice(index) } : s;
      });
      // A little slack: the fade-in animation started at commit, this timer only after it, but timers
      // aren't frame-exact — never pull the old scene out before the new one is fully opaque.
    }, FADE_MS + 150);
    return () => clearTimeout(timeout);
  }, [state.shownKey]);

  return (
    <>
      {state.scenes.map((scene) => (
        <AmbientScene
          key={scene.key}
          // The current track's cover version can change while it plays (cover edited).
          scene={track && scene.trackId === track.id ? { ...scene, coverVersion: track.coverVersion } : scene}
          onReady={handleReady}
        />
      ))}
    </>
  );
}

export function AmbientBackground() {
  const { currentTrack, ambientMode, isPlaying } = usePlayer();

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
              <AmbientScenes track={currentTrack ?? null} />
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
