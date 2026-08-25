"use client";

import React, { useEffect, useState } from "react";
import { 
  Play, Pause, SkipForward, SkipBack, Volume2, 
  Disc3, Music2, SlidersHorizontal
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { usePlayer } from "@/components/providers/player-provider";
import { usePathname } from "next/navigation";

export function BottomPlayer() {
  const pathname = usePathname();
  const {
    currentTrack,
    isPlaying,
    setIsPlaying,
    scratching,
    setScratching,
    stemsOpen,
    setStemsOpen,
    audioRef,
    filteredTracks,
    setCurrentTrack
  } = usePlayer();

  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(80);

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
    }
  }, [volume, audioRef]);

  const formatTime = (time: number) => {
    if (isNaN(time) || !isFinite(time)) return "0:00";
    const m = Math.floor(time / 60);
    const s = Math.floor(time % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!audioRef.current || !duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const percent = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    audioRef.current.currentTime = percent * duration;
  };

  const playNext = () => {
    const currentIndex = filteredTracks.findIndex(t => t.id === currentTrack.id);
    if (currentIndex >= 0 && currentIndex < filteredTracks.length - 1) {
      setCurrentTrack(filteredTracks[currentIndex + 1]);
      setIsPlaying(true);
    }
  };

  const playPrev = () => {
    const currentIndex = filteredTracks.findIndex(t => t.id === currentTrack.id);
    if (currentIndex > 0) {
      setCurrentTrack(filteredTracks[currentIndex - 1]);
      setIsPlaying(true);
    } else if (audioRef.current) {
      audioRef.current.currentTime = 0;
    }
  };

  if (pathname === '/' || pathname === '/login') {
    return null;
  }

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;
  const safeVolume = typeof volume === 'number' && !isNaN(volume) ? volume : 80;

  return (
    <div className="fixed bottom-0 left-0 right-0 h-24 bg-black border-t border-zinc-900 z-50 flex items-center px-6 gap-8">
      {/* Track Info */}
      <div className="flex items-center gap-4 w-1/4 min-w-[240px]">
        {/* Easter Egg 4: Vinyl Spinning & Scratching */}
        <div 
          className={`relative w-14 h-14 rounded-md bg-zinc-900 flex items-center justify-center border border-zinc-800 overflow-hidden cursor-pointer ${scratching ? 'scale-110 skew-x-12' : 'transition-transform'}`}
          onMouseDown={() => setScratching(true)}
          onMouseUp={() => setScratching(false)}
          onMouseLeave={() => setScratching(false)}
        >
          {isPlaying && !scratching && (
            <div className="absolute inset-0 bg-white/5 animate-pulse"></div>
          )}
          {isPlaying ? (
            <Disc3 className={`w-8 h-8 text-zinc-300 ${scratching ? 'animate-none rotate-45 text-white' : 'animate-[spin_2s_linear_infinite]'}`} />
          ) : (
            <Music2 className="w-5 h-5 text-zinc-600" />
          )}
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
          <div 
            className="group relative flex-1 h-2 flex items-center cursor-pointer"
            onClick={handleSeek}
          >
            <div className="absolute h-1 w-full bg-zinc-900 rounded-full overflow-hidden pointer-events-none">
              <div 
                className="h-full bg-white rounded-full group-hover:bg-zinc-300 transition-colors pointer-events-none"
                style={{ width: `${progressPercent}%` }}
              ></div>
            </div>
            <div 
              className="absolute h-3 w-3 bg-white rounded-full -ml-1.5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"
              style={{ left: `${progressPercent}%` }}
            ></div>
          </div>
          <span className="w-8">{formatTime(duration)}</span>
        </div>
      </div>

      {/* Right Controls (Volume + Stems) */}
      <div className="w-1/4 min-w-[240px] flex items-center justify-end gap-6">
        <div className="flex items-center gap-3 w-32 group">
          <Volume2 className="w-4 h-4 text-zinc-500 group-hover:text-zinc-400 transition-colors shrink-0" />
          <Slider 
            value={[safeVolume]} 
            max={100} 
            step={1} 
            onValueChange={val => {
              let nextVol = Array.isArray(val) ? val[0] : val;
              if (typeof nextVol === 'number' && !isNaN(nextVol)) {
                setVolume(nextVol);
              }
            }}
            className="w-full" 
          />
        </div>
        
        <Dialog open={stemsOpen} onOpenChange={setStemsOpen}>
          <DialogTrigger render={
            <Button 
              variant="outline" 
              className={`gap-2 h-9 px-3 rounded-md text-xs font-medium border-zinc-800 bg-zinc-900 hover:bg-zinc-800 hover:text-white transition-all ${currentTrack.stems !== 'Ready' && 'opacity-50 pointer-events-none'}`}
            >
              <SlidersHorizontal className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
              Stems
            </Button>
          } />
          <DialogContent className="bg-black border-zinc-900 text-white sm:max-w-md rounded-xl p-6">
            <DialogHeader className="mb-6">
              <DialogTitle className="flex items-center gap-3 text-lg font-medium">
                <div className="w-8 h-8 rounded-md bg-zinc-900 flex items-center justify-center border border-zinc-800">
                  <SlidersHorizontal className="w-4 h-4 text-zinc-300" />
                </div>
                Stem Mixer
              </DialogTitle>
              <p className="text-sm text-zinc-500">Fine-tune elements for <span className="text-zinc-300">{currentTrack.title}</span></p>
            </DialogHeader>
            
            <div className="space-y-4 py-2">
              {["Vocals", "Drums", "Bass", "Melody"].map((stem) => (
                <div key={stem} className="flex items-center gap-4 bg-zinc-950 p-3 rounded-lg border border-zinc-900">
                  <div className="w-16 text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                    {stem}
                  </div>
                  <Slider defaultValue={[100]} max={100} step={1} className="flex-1" />
                  <div className="flex gap-1.5 shrink-0">
                    <Button variant="ghost" size="icon" className="h-7 w-7 rounded-md text-[10px] font-bold bg-zinc-900 hover:bg-zinc-800 text-zinc-500 hover:text-white transition-colors border border-zinc-800">M</Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 rounded-md text-[10px] font-bold bg-zinc-900 hover:bg-zinc-800 text-zinc-500 hover:text-white transition-colors border border-zinc-800">S</Button>
                  </div>
                </div>
              ))}
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
