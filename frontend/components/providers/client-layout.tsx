"use client";

import React, { useState, useEffect } from "react";
import { PlayerProvider, usePlayer } from "./player-provider";
import { PlaylistProvider } from "./playlist-provider";
import { GenreProvider } from "./genre-provider";
import { BottomPlayer } from "@/components/layout/bottom-player";
import { colorThemes } from "@/lib/data";

function PlayerLayout({ children }: { children: React.ReactNode }) {
  const [raveMode, setRaveMode] = useState(false);
  const { themeIndex } = usePlayer();

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
      className={`flex flex-col h-screen overflow-hidden transition-all duration-1000 ${raveMode ? 'rave-active' : ''}`}
      style={{ filter: !raveMode ? colorThemes[themeIndex].filter : undefined }}
    >
      {/* EASTER EGG CSS */}
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes rave {
          0% { filter: hue-rotate(0deg) saturate(250%) contrast(120%); }
          100% { filter: hue-rotate(360deg) saturate(250%) contrast(120%); }
        }
        .rave-active {
          animation: rave 1.5s linear infinite;
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
