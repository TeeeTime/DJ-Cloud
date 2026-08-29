"use client";

import React, { useEffect, useState } from "react";
import {
  Play, Pause, SkipForward, SkipBack, Volume, Volume1, Volume2, VolumeX,
  Disc3, Music2
} from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { QueueStatusWidget } from "@/components/layout/queue-status";
import { usePlayer } from "@/components/providers/player-provider";
import { usePathname } from "next/navigation";

function TrackCover({ src, isPlaying, scratching }: { src: string; isPlaying: boolean; scratching: boolean }) {
  const [error, setError] = useState(false);

  if (error) {
    return isPlaying ? (
      <Disc3 className={`w-8 h-8 text-zinc-300 ${scratching ? 'animate-none rotate-45 text-white' : 'animate-[spin_2s_linear_infinite]'}`} />
    ) : (
      <Music2 className="w-5 h-5 text-zinc-600" />
    );
  }

  return (
    <img
      src={src}
      alt=""
      onError={() => setError(true)}
      className="absolute inset-0 w-full h-full object-cover"
    />
  );
}

export function BottomPlayer() {
  const pathname = usePathname();
  const {
    currentTrack,
    isPlaying,
    setIsPlaying,
    scratching,
    setScratching,
    audioRef,
    filteredTracks,
    setCurrentTrack
  } = usePlayer();

  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(80);

  // Load volume from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem("djcloud_volume");
    if (saved !== null) {
      const parsed = parseFloat(saved);
      if (!isNaN(parsed)) setVolume(parsed);
    }
  }, []);

  // Global keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }
      if (e.code === 'Space') {
        e.preventDefault();
        setIsPlaying(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [setIsPlaying]);

  // Sync play/pause
  useEffect(() => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.play().catch(e => console.error("Playback failed:", e));
    } else {
      audioRef.current.pause();
    }
  }, [isPlaying, currentTrack, audioRef]);

  // Sync time and duration
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const updateTime = () => setCurrentTime(audio.currentTime);
    const updateDuration = () => setDuration(audio.duration);

    audio.addEventListener("timeupdate", updateTime);
    audio.addEventListener("loadedmetadata", updateDuration);
    audio.addEventListener("durationchange", updateDuration);

    // Initial check in case it's already loaded
    if (audio.duration && !isNaN(audio.duration)) {
      setDuration(audio.duration);
    } else {
      setDuration(0);
    }

    return () => {
      audio.removeEventListener("timeupdate", updateTime);
      audio.removeEventListener("loadedmetadata", updateDuration);
      audio.removeEventListener("durationchange", updateDuration);
    };
  }, [audioRef, currentTrack]);

  // Sync volume
  useEffect(() => {
    if (audioRef.current && typeof volume === 'number' && !isNaN(volume)) {
      audioRef.current.volume = Math.max(0, Math.min(1, volume / 100));
      localStorage.setItem("djcloud_volume", volume.toString());
    }
  }, [volume, audioRef]);

  const formatTime = (time: number) => {
    if (isNaN(time) || !isFinite(time)) return "0:00";
    const m = Math.floor(time / 60);
    const s = Math.floor(time % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const handleSeek = (val: number | readonly number[]) => {
    if (!audioRef.current || !duration) return;
    const percent = Array.isArray(val) ? val[0] : val;
    audioRef.current.currentTime = (percent / 100) * duration;
  };

  const playNext = () => {
    if (!currentTrack) return;
    const currentIndex = filteredTracks.findIndex(t => t.id === currentTrack.id);
    if (currentIndex >= 0 && currentIndex < filteredTracks.length - 1) {
      setCurrentTrack(filteredTracks[currentIndex + 1]);
      setIsPlaying(true);
    }
  };

  const playPrev = () => {
    if (!currentTrack) return;
    const currentIndex = filteredTracks.findIndex(t => t.id === currentTrack.id);
    if (currentIndex > 0) {
      setCurrentTrack(filteredTracks[currentIndex - 1]);
      setIsPlaying(true);
    } else if (audioRef.current) {
      audioRef.current.currentTime = 0;
    }
  };

  if (pathname === '/' || pathname === '/login' || pathname === '/register' || !currentTrack) {
    return null;
  }

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;
  const safeVolume = typeof volume === 'number' && !isNaN(volume) ? volume : 80;

  return (
    <div className="h-24 shrink-0 bg-black border-t border-zinc-900 z-50 flex items-center px-4 md:px-8 gap-4 shadow-[0_-10px_40px_rgba(0,0,0,0.5)]">
      {/* Track Info */}
      <div className="flex items-center gap-4 w-1/4 min-w-[280px]">
        {/* Easter Egg 4: Vinyl Spinning & Scratching */}
        <div 
          className={`relative w-14 h-14 shrink-0 rounded-md bg-zinc-900 flex items-center justify-center border border-zinc-800 overflow-hidden cursor-pointer ${scratching ? 'scale-110 skew-x-12' : 'transition-transform'}`}
          onMouseDown={() => setScratching(true)}
          onMouseUp={() => setScratching(false)}
          onMouseLeave={() => setScratching(false)}
        >
          {isPlaying && !scratching && (
            <div className="absolute inset-0 bg-white/5 animate-pulse"></div>
          )}
          <TrackCover key={currentTrack.id} src={currentTrack.coverUrl} isPlaying={isPlaying} scratching={scratching} />
        </div>

        <div className="flex flex-col truncate">
          <span className="font-medium text-white truncate text-sm">{currentTrack.title}</span>
          <span className="text-zinc-500 text-xs truncate mt-0.5">{currentTrack.artist}</span>
        </div>
      </div>

      {/* Player Controls */}
      <div className="flex-1 flex flex-col items-center justify-center gap-2 max-w-2xl">
        <div className="flex items-center gap-6">
          <button onClick={playPrev} className="text-zinc-500 hover:text-white transition-colors">
            <SkipBack className="w-4 h-4 fill-current" />
          </button>
          <button
            onClick={() => setIsPlaying(!isPlaying)}
            className="w-10 h-10 flex items-center justify-center rounded-full bg-white hover:bg-zinc-200 text-black transition-all active:scale-95"
          >
            {isPlaying ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current ml-0.5" />}
          </button>
          <button onClick={playNext} className="text-zinc-500 hover:text-white transition-colors">
            <SkipForward className="w-4 h-4 fill-current" />
          </button>
        </div>
        <div className="flex items-center gap-3 w-full text-xs text-zinc-500 font-mono">
          <span className="w-8 text-right">{formatTime(currentTime)}</span>
          <div className="flex-1 px-2 flex items-center">
            <Slider 
              value={[progressPercent]}
              max={100}
              step={0.1}
              onValueChange={handleSeek}
              className="w-full"
            />
          </div>
          <span className="w-8">{formatTime(duration)}</span>
        </div>
      </div>

      {/* Right Controls (Volume + Queue Status) */}
      <div className="w-1/4 min-w-[280px] flex items-center justify-between gap-4">
        <div 
          className="flex items-center gap-3 w-32 group"
          onWheel={(e) => {
            const delta = e.deltaY > 0 ? -5 : 5;
            let nextVol = safeVolume + delta;
            nextVol = Math.max(0, Math.min(100, nextVol));
            setVolume(nextVol);
          }}
        >
          {safeVolume === 0 ? (
            <VolumeX className="w-4 h-4 text-zinc-500 group-hover:text-zinc-400 transition-colors shrink-0" />
          ) : safeVolume < 33 ? (
            <Volume className="w-4 h-4 text-zinc-500 group-hover:text-zinc-400 transition-colors shrink-0" />
          ) : safeVolume < 66 ? (
            <Volume1 className="w-4 h-4 text-zinc-500 group-hover:text-zinc-400 transition-colors shrink-0" />
          ) : (
            <Volume2 className="w-4 h-4 text-zinc-500 group-hover:text-zinc-400 transition-colors shrink-0" />
          )}
          <Slider
            value={[safeVolume]}
            max={100}
            step={1}
            onValueChange={val => {
              const nextVol = Array.isArray(val) ? val[0] : val;
              if (typeof nextVol === 'number' && !isNaN(nextVol)) {
                setVolume(nextVol);
              }
            }}
            className="w-full"
          />
        </div>
        <QueueStatusWidget />
      </div>
    </div>
  );
}
