"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  Menu, Music2, Users, HardDrive, Play, Pause,
  Disc3, ListMusic, Activity, Loader2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";
import { Sidebar } from "@/components/layout/sidebar";
import { useAuth } from "@/components/providers/auth-provider";
import { usePlayer } from "@/components/providers/player-provider";
import { tracksApi, genresApi, authApi, RecentTrackResponse, GenreDistributionResponse } from "@/lib/api";
import { formatTimeAgo, mapTrackResponse } from "@/lib/data";
import { motion } from "motion/react";

const RECENT_TRACKS_LIMIT = 7;
const TOP_GENRES_COUNT = 4;

type GenreBar = { name: string; percent: number };

function toGenreBars(distribution: GenreDistributionResponse[]): GenreBar[] {
  const total = distribution.reduce((sum, g) => sum + g.count, 0);
  if (total === 0) return [];

  const top = distribution.slice(0, TOP_GENRES_COUNT);
  const rest = distribution.slice(TOP_GENRES_COUNT);
  const bars = top.map(g => ({ name: g.name, percent: Math.round((g.count / total) * 100) }));

  if (rest.length > 0) {
    const otherCount = rest.reduce((sum, g) => sum + g.count, 0);
    bars.push({ name: "Other", percent: Math.round((otherCount / total) * 100) });
  }

  return bars;
}

export function OverviewView() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { user, token } = useAuth();
  const { tracks, currentTrack, isPlaying, setCurrentTrack, setIsPlaying } = usePlayer();

  const [recentTracks, setRecentTracks] = useState<RecentTrackResponse[]>([]);
  const [newCount, setNewCount] = useState(0);
  const [recentLoading, setRecentLoading] = useState(true);

  const [genreDistribution, setGenreDistribution] = useState<GenreDistributionResponse[]>([]);
  const [genresLoading, setGenresLoading] = useState(true);

  useEffect(() => {
    if (!token) return;

    let cancelled = false;
    tracksApi.recent(RECENT_TRACKS_LIMIT, token)
      .then(response => {
        if (cancelled) return;
        setRecentTracks(response.tracks);
        setNewCount(response.newCount);
        // Fire-and-forget: marks the list seen now that it's been fetched (and about to be
        // rendered) — a failure here just means "new" badges may reappear next visit, not critical.
        // Ticks off every new track, including any beyond RECENT_TRACKS_LIMIT that weren't shown —
        // simplest option, per the user.
        authApi.markRecentlyAddedSeen(token).catch(() => {});
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setRecentLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [token]);

  useEffect(() => {
    let cancelled = false;
    genresApi.distribution()
      .then(distribution => {
        if (!cancelled) setGenreDistribution(distribution);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setGenresLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const topGenres = toGenreBars(genreDistribution);

  const visibleNewCount = recentTracks.filter(t => t.isNew).length;
  const moreNewCount = Math.max(0, newCount - visibleNewCount);

  const playRecentTrack = async (recentTrack: RecentTrackResponse) => {
    if (currentTrack?.id === recentTrack.id) {
      setIsPlaying(!isPlaying);
      return;
    }

    // Prefer the already-loaded full Track (has bpm/key/genres/etc.) if it's in the library list
    // fetched elsewhere in the app; otherwise fetch it directly — this endpoint is public.
    const existing = tracks.find(t => t.id === recentTrack.id);
    if (existing) {
      setCurrentTrack(existing);
      setIsPlaying(true);
      return;
    }

    try {
      const full = await tracksApi.get(recentTrack.id);
      setCurrentTrack(mapTrackResponse(full));
      setIsPlaying(true);
    } catch (err) {
      console.error("Failed to load track for playback", err);
    }
  };

  return (
    <main className="flex-1 flex flex-col min-w-0 bg-black relative h-full">
      {/* Header */}
      <header className="h-16 flex items-center justify-between px-4 md:px-8 border-b border-zinc-900 bg-black/50 backdrop-blur-xl sticky top-0 z-10 shrink-0 gap-4">
        <div className="flex items-center gap-4 flex-1">
          {/* Mobile Menu Trigger */}
          <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
            <SheetTrigger render={<Button variant="ghost" size="icon" className="md:hidden text-zinc-400 hover:text-white shrink-0" />}>
              <Menu className="w-5 h-5" />
            </SheetTrigger>
            <SheetContent side="left" className="p-0 bg-black border-r border-zinc-900 w-64 sm:max-w-64">
              <SheetTitle className="sr-only">Navigation Menu</SheetTitle>
              <Sidebar isMobile={true} />
            </SheetContent>
          </Sheet>
        </div>
      </header>

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto no-scrollbar">
        <div className="px-4 md:px-8 py-8 max-w-7xl mx-auto">
          
          <div className="mb-8">
            <h2 className="text-2xl md:text-3xl font-bold tracking-tight mb-1 text-white">
              Vault Overview
            </h2>
            <p className="text-sm text-zinc-500">Your personal DJ-Cloud statistics and recent activity.</p>
          </div>

          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, staggerChildren: 0.1 }}
            className="grid grid-cols-1 md:grid-cols-12 gap-6"
          >

            {/* Recently Added List - Takes 8 grid cells */}
            <motion.div 
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="md:col-span-8 bg-zinc-950 border border-zinc-900 rounded-xl p-6 hover:border-zinc-800 transition-all duration-300 flex flex-col h-full min-h-[400px]"
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-base font-semibold text-white">Recently Added</h3>
                <Link href="/library">
                  <Button variant="ghost" className="text-xs text-zinc-400 hover:text-white h-8 hover:bg-zinc-900 transition-colors">View All</Button>
                </Link>
              </div>
              <div className="flex-1 overflow-y-auto pr-2 space-y-1 no-scrollbar">
                {recentLoading ? (
                  <div className="h-full flex items-center justify-center">
                    <Loader2 className="w-5 h-5 animate-spin text-zinc-600" />
                  </div>
                ) : recentTracks.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-sm text-zinc-600">
                    No tracks yet.
                  </div>
                ) : (
                  <>
                    {recentTracks.map((track) => (
                      <div
                        key={track.id}
                        onClick={() => playRecentTrack(track)}
                        className={`relative flex items-center justify-between p-3 rounded-lg hover:bg-zinc-900/60 transition-colors group cursor-pointer ${currentTrack?.id === track.id ? 'bg-zinc-900/40' : ''}`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-10 h-10 rounded-md bg-zinc-900 border border-zinc-800 flex items-center justify-center shrink-0 group-hover:bg-zinc-800 group-hover:border-zinc-700 transition-all">
                            <Disc3 className="w-5 h-5 text-zinc-500 group-hover:text-white transition-colors" />
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-medium text-zinc-200 group-hover:text-white transition-colors truncate">{track.title}</p>
                              {track.isNew && (
                                <span className="shrink-0 text-[10px] font-bold uppercase tracking-wider text-black bg-white rounded px-1.5 py-0.5">New</span>
                              )}
                            </div>
                            <p className="text-xs text-zinc-500 truncate">{track.artists.length > 0 ? track.artists.join(", ") : "Unknown Artist"}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <span className={`text-xs text-zinc-500 hidden sm:block transition-opacity duration-200 ${currentTrack?.id === track.id ? 'opacity-0' : 'opacity-100 group-hover:opacity-0'}`}>{formatTimeAgo(track.addedAt)}</span>
                          <div className={`absolute right-9 transition-all duration-300 ${currentTrack?.id === track.id ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-2 group-hover:opacity-100 group-hover:translate-x-0'}`}>
                            <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center shadow-md">
                              {currentTrack?.id === track.id && isPlaying ? (
                                <Pause className="w-3.5 h-3.5 text-black fill-current" />
                              ) : (
                                <Play className="w-3.5 h-3.5 text-black fill-current ml-0.5" />
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                    {moreNewCount > 0 && (
                      <p className="text-xs text-zinc-500 text-center py-2">
                        +{moreNewCount} more new track{moreNewCount === 1 ? "" : "s"}
                      </p>
                    )}
                  </>
                )}
              </div>
            </motion.div>

            {/* Top Genres Breakdown - Takes 4 grid cells */}
            <motion.div 
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5, delay: 0.3 }}
              className="md:col-span-4 self-start bg-zinc-950 border border-zinc-900 rounded-xl p-6 hover:border-zinc-800 transition-all duration-300 flex flex-col"
            >
              <div className="flex items-center justify-between mb-8">
                <h3 className="text-base font-semibold text-white">Top Genres</h3>
              </div>

              <div className="flex flex-col space-y-6">
                {genresLoading ? (
                  <div className="flex items-center justify-center">
                    <Loader2 className="w-5 h-5 animate-spin text-zinc-600" />
                  </div>
                ) : topGenres.length === 0 ? (
                  <div className="flex items-center justify-center text-sm text-zinc-600">
                    No genres yet.
                  </div>
                ) : (
                  topGenres.map((genre, i) => (
                    <div key={genre.name} className="group cursor-default">
                      <div className="flex justify-between text-sm mb-2">
                        <span className={`transition-colors ${i === 0 ? 'text-white font-medium' : 'text-zinc-400 group-hover:text-zinc-300'}`}>{genre.name}</span>
                        <span className="text-zinc-500 font-mono text-xs">{genre.percent}%</span>
                      </div>
                      <div className="h-1.5 w-full bg-zinc-900 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-1000 ease-out ${i === 0 ? 'bg-white' : 'bg-zinc-500 group-hover:bg-zinc-400'}`}
                          style={{ width: `${genre.percent}%` }}
                        ></div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </motion.div>

          </motion.div>
        </div>
      </div>
    </main>
  );
}
