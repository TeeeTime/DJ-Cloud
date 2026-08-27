"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  Menu, Music2, Users, HardDrive, Play,
  Disc3, ListMusic, Activity
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";
import { Sidebar } from "@/components/layout/sidebar";
import { useAuth } from "@/components/providers/auth-provider";
import { motion } from "motion/react";

export function OverviewView() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { user } = useAuth();

  // Mock Data
  const stats = [
    { label: "Total Tracks", value: "1,248", icon: Music2, color: "text-blue-500", bg: "bg-blue-500/10 border-blue-500/20" },
    { label: "Artists", value: "312", icon: Users, color: "text-purple-500", bg: "bg-purple-500/10 border-purple-500/20" },
    { label: "Storage Used", value: "48.2 GB", icon: HardDrive, color: "text-emerald-500", bg: "bg-emerald-500/10 border-emerald-500/20" },
  ];

  const mockPlaylists = [
    { id: 1, name: "Summer Vibes '26", tracks: 42 },
    { id: 2, name: "Deep Tech Afterhours", tracks: 18 },
    { id: 3, name: "D&B Rollers", tracks: 55 },
  ];

  const recentTracks = [
    { id: 1, title: "Midnight City", artist: "M83", time: "2 hours ago" },
    { id: 2, title: "Opus", artist: "Eric Prydz", time: "5 hours ago" },
    { id: 3, title: "Inspector Norse", artist: "Todd Terje", time: "1 day ago" },
    { id: 4, title: "Strobe", artist: "deadmau5", time: "2 days ago" },
    { id: 5, title: "Bicep", artist: "Glue", time: "3 days ago" },
    { id: 6, title: "Innerbloom", artist: "RÜFÜS DU SOL", time: "3 days ago" },
    { id: 7, title: "Losing It", artist: "FISHER", time: "4 days ago" },
    { id: 8, title: "You & Me (Flume Remix)", artist: "Disclosure", time: "5 days ago" },
    { id: 9, title: "Goosebumps", artist: "Travis Scott", time: "1 week ago" },
  ];

  const topGenres = [
    { name: "House", percent: 45 },
    { name: "Techno", percent: 25 },
    { name: "Drum & Bass", percent: 15 },
    { name: "Trance", percent: 10 },
    { name: "Other", percent: 5 },
  ];

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

          <div className="flex items-center gap-2 md:gap-3">
            <h1 className="text-sm font-medium text-zinc-500 hidden md:block">
              User: <span className="text-zinc-300">{user?.username || 'DJ'}</span>
            </h1>
            <span className="hidden md:block text-zinc-700">|</span>
            <div className="flex items-center gap-1.5 md:gap-2 text-[10px] md:text-xs font-medium text-zinc-500 bg-zinc-900/50 px-2.5 md:px-3 py-1 rounded-full border border-zinc-800/50">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shrink-0"></div>
              <span className="hidden sm:inline">System Online</span>
              <span className="hidden sm:inline text-zinc-700">•</span>
              <span className="flex items-center gap-1">
                <Activity className="w-3 h-3 shrink-0" /> 12%
                <span className="hidden sm:inline">Load</span>
              </span>
              <span className="hidden sm:inline text-zinc-700">•</span>
              <span className="hidden sm:inline">32ms</span>
            </div>
          </div>
        </div>
      </header>

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto pb-32 no-scrollbar">
        <div className="px-4 md:px-8 py-8 max-w-7xl mx-auto">
          
          <div className="mb-8">
            <h2 className="text-2xl md:text-3xl font-bold tracking-tight mb-1 text-white">
              Vault Overview
            </h2>
            <p className="text-sm text-zinc-500">Your personal DJ-Cloud statistics and recent activity.</p>
          </div>

          {/* Grid Layout - 12 Columns total */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, staggerChildren: 0.1 }}
            className="grid grid-cols-1 md:grid-cols-12 gap-6"
          >
            
            {/* Quick Stats - 3 Columns (each taking 4 grid cells) */}
            {stats.map((stat, i) => (
              <motion.div 
                key={i} 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: i * 0.1 }}
                className="md:col-span-4 bg-zinc-950 border border-zinc-900 rounded-xl p-6 hover:border-zinc-700 hover:shadow-xl transition-all duration-300 group flex flex-col justify-between h-36 relative overflow-hidden"
              >
                <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 rounded-bl-full pointer-events-none"></div>
                <div className="flex items-center justify-between relative z-10">
                  <p className="text-sm font-medium text-zinc-400 group-hover:text-zinc-300 transition-colors">{stat.label}</p>
                  <div className={`w-8 h-8 rounded-lg border flex items-center justify-center ${stat.bg} ${stat.color} group-hover:scale-110 transition-transform duration-300`}>
                    <stat.icon className="w-4 h-4" />
                  </div>
                </div>
                <div className="relative z-10">
                  <h3 className="text-3xl font-bold text-white tracking-tight group-hover:translate-x-1 transition-transform duration-300">{stat.value}</h3>
                </div>
              </motion.div>
            ))}

            {/* Featured Playlists - 3 Columns (each taking 4 grid cells) */}
            {mockPlaylists.map((pl, i) => (
              <motion.div 
                key={pl.id} 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.4, delay: 0.3 + (i * 0.1) }}
                className="md:col-span-4 bg-zinc-950 border border-zinc-900 rounded-xl p-6 hover:border-zinc-700 hover:bg-zinc-900/30 transition-all duration-300 group cursor-pointer relative flex flex-col min-h-[140px] overflow-hidden"
              >
                <div className="absolute -right-4 -top-4 w-24 h-24 bg-zinc-800/20 rounded-full blur-2xl group-hover:bg-zinc-700/30 transition-colors duration-500"></div>
                <div className="absolute top-5 right-5 w-10 h-10 rounded-full bg-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300 translate-y-2 group-hover:translate-y-0 shadow-lg">
                  <Play className="w-4 h-4 text-black fill-current ml-0.5" />
                </div>
                <div className="mt-auto relative z-10">
                  <ListMusic className="w-5 h-5 text-zinc-500 mb-3 group-hover:text-white transition-colors duration-300" />
                  <h3 className="text-base font-bold text-zinc-200 group-hover:text-white transition-colors">{pl.name}</h3>
                  <p className="text-xs font-medium text-zinc-500 mt-1">{pl.tracks} Tracks</p>
                </div>
              </motion.div>
            ))}

            {/* Recently Added List - Takes 8 grid cells */}
            <motion.div 
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5, delay: 0.6 }}
              className="md:col-span-8 bg-zinc-950 border border-zinc-900 rounded-xl p-6 hover:border-zinc-800 transition-all duration-300 flex flex-col h-[340px]"
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-base font-semibold text-white">Recently Added</h3>
                <Link href="/library">
                  <Button variant="ghost" className="text-xs text-zinc-400 hover:text-white h-8 hover:bg-zinc-900 transition-colors">View All</Button>
                </Link>
              </div>
              <div className="flex-1 overflow-y-auto pr-2 space-y-1 no-scrollbar">
                {recentTracks.map((track) => (
                  <div key={track.id} className="flex items-center justify-between p-3 rounded-lg hover:bg-zinc-900/60 transition-colors group cursor-pointer">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-md bg-zinc-900 border border-zinc-800 flex items-center justify-center shrink-0 group-hover:bg-zinc-800 group-hover:border-zinc-700 transition-all">
                        <Disc3 className="w-5 h-5 text-zinc-500 group-hover:text-white transition-colors" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-zinc-200 group-hover:text-white transition-colors">{track.title}</p>
                        <p className="text-xs text-zinc-500">{track.artist}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="text-xs text-zinc-500 hidden sm:block opacity-100 group-hover:opacity-0 transition-opacity duration-200">{track.time}</span>
                      <div className="absolute right-9 opacity-0 group-hover:opacity-100 transition-all duration-300 translate-x-2 group-hover:translate-x-0">
                        <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center shadow-md">
                          <Play className="w-3.5 h-3.5 text-black fill-current ml-0.5" />
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>

            {/* Top Genres Breakdown - Takes 4 grid cells */}
            <motion.div 
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5, delay: 0.7 }}
              className="md:col-span-4 bg-zinc-950 border border-zinc-900 rounded-xl p-6 hover:border-zinc-800 transition-all duration-300 flex flex-col h-[340px]"
            >
              <div className="flex items-center justify-between mb-8">
                <h3 className="text-base font-semibold text-white">Top Genres</h3>
              </div>
              
              <div className="flex-1 flex flex-col justify-center space-y-6">
                {topGenres.map((genre, i) => (
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
                ))}
              </div>
            </motion.div>

          </motion.div>
        </div>
      </div>
    </main>
  );
}
