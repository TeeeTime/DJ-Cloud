"use client";

import React, { useState, useEffect } from "react";
import { PlayerProvider, usePlayer } from "./player-provider";
import { PlaylistProvider } from "./playlist-provider";
import { GenreProvider } from "./genre-provider";
import { BottomPlayer } from "@/components/layout/bottom-player";
import { AmbientBackground } from "@/components/layout/ambient-background";
import { colorThemes } from "@/lib/data";

function PlayerLayout({ children }: { children: React.ReactNode }) {
  const [raveMode, setRaveMode] = useState(false);
  const { themeIndex, ambientMode, currentTrack } = usePlayer();
  const isAmbientActive = ambientMode && !!currentTrack?.coverUrl;

  // Easter Egg 1: Konami Code
  useEffect(() => {
    const konamiCode = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a'];
    let konamiIndex = 0;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === konamiCode[konamiIndex]) {
        konamiIndex++;
        if (konamiIndex === konamiCode.length) {
          setRaveMode(prev => !prev);
          konamiIndex = 0;
        }
      } else {
        konamiIndex = 0;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <div 
      className={`flex flex-col h-screen overflow-hidden transition-all duration-1000 relative ${raveMode ? 'rave-active' : ''} ${isAmbientActive ? 'ambient-active' : ''}`}
      style={{ filter: !raveMode ? colorThemes[themeIndex].filter : undefined }}
    >
      <AmbientBackground />
      {/* EASTER EGG & AMBIENT MODE CSS */}
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes rave {
          0% { filter: hue-rotate(0deg) saturate(250%) contrast(120%); }
          100% { filter: hue-rotate(360deg) saturate(250%) contrast(120%); }
        }
        .rave-active {
          animation: rave 1.5s linear infinite;
        }

        /* Ambient Mode surface transitions */
        .ambient-surface-page,
        .ambient-surface-sidebar,
        .ambient-surface-player,
        .ambient-surface-header,
        .ambient-surface-main,
        .ambient-surface-card {
          transition: background-color 700ms ease, border-color 700ms ease, backdrop-filter 700ms ease;
        }

        /* When ambient mode is active, make surfaces translucent to reveal the ambient glow */
        .ambient-active .ambient-surface-page {
          background-color: transparent !important;
        }
        .ambient-active .ambient-surface-sidebar {
          background-color: rgba(0, 0, 0, 0.55) !important;
          backdrop-filter: blur(24px) !important;
          border-color: rgba(39, 39, 42, 0.5) !important;
        }
        .ambient-active .ambient-surface-player {
          background-color: rgba(0, 0, 0, 0.75) !important;
          backdrop-filter: blur(24px) !important;
          border-color: rgba(39, 39, 42, 0.6) !important;
        }
        .ambient-active .ambient-surface-header {
          background-color: rgba(0, 0, 0, 0.35) !important;
          backdrop-filter: blur(20px) !important;
          border-color: rgba(39, 39, 42, 0.5) !important;
        }
        .ambient-active .ambient-surface-main {
          background-color: transparent !important;
        }
        .ambient-active .ambient-surface-card {
          background-color: rgba(0, 0, 0, 0.35) !important;
          backdrop-filter: blur(12px) !important;
          border-color: rgba(39, 39, 42, 0.45) !important;
        }
        .ambient-active [data-slot="card"] {
          background-color: rgba(0, 0, 0, 0.35) !important;
          backdrop-filter: blur(12px) !important;
          transition: background-color 700ms ease, backdrop-filter 700ms ease;
        }
      `}} />
      
      {children}
      
      <BottomPlayer />
    </div>
  );
}

export function ClientLayout({ children }: { children: React.ReactNode }) {
  return (
    <PlayerProvider>
      <PlaylistProvider>
        <GenreProvider>
          <PlayerLayout>
            {children}
          </PlayerLayout>
        </GenreProvider>
      </PlaylistProvider>
    </PlayerProvider>
  );
}
