"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutGrid, Library, ListMusic, Plus, Disc3 } from "lucide-react";
import { playlists, genres } from "@/lib/data";
import { usePlayer } from "@/components/providers/player-provider";
import { AuroraText } from "@/components/ui/aurora-text";

export function Sidebar() {
  const { activeFilter, setActiveFilter } = usePlayer();
  const pathname = usePathname();

  return (
    <aside className="w-64 border-r border-zinc-900 bg-black flex flex-col hidden md:flex z-20 shrink-0">
      {/* Brand */}
      <Link href="/">
        <div className="h-20 flex items-center px-6 border-b border-zinc-900 cursor-pointer group">
          <h1 className="text-xl font-black tracking-tighter group-hover:scale-105 transition-transform origin-left">
            <AuroraText colors={["#ffffff", "#a1a1aa", "#52525b", "#ffffff"]}>DJ-CLOUD</AuroraText>
          </h1>
        </div>
      </Link>

      {/* Navigation */}
      <div className="flex-1 overflow-y-auto py-6 px-3 flex flex-col gap-8 no-scrollbar">
        
        {/* Main Links */}
        <div className="space-y-1">
          <Link href="/">
            <button 
              className={`w-full flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-md transition-colors ${pathname === '/' ? 'bg-zinc-900 text-white' : 'text-zinc-400 hover:bg-zinc-900/50 hover:text-white'}`}
            >
              <LayoutGrid className="w-4 h-4" />
              Overview
            </button>
          </Link>
          <Link href="/library">
            <button 
              onClick={() => {
                setActiveFilter({ type: 'all', value: 'All Tracks' });
              }}
              className={`w-full flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-md transition-colors ${pathname === '/library' && activeFilter.type === 'all' ? 'bg-zinc-900 text-white' : 'text-zinc-400 hover:bg-zinc-900/50 hover:text-white'}`}
            >
              <Library className="w-4 h-4" />
              All Tracks
            </button>
          </Link>
        </div>

        {/* Playlists */}
        <div>
          <div className="flex items-center justify-between px-3 mb-2">
            <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Playlists</h2>
            <button className="text-zinc-500 hover:text-white transition-colors">
              <Plus className="w-4 h-4" />
            </button>
          </div>
          <div className="space-y-0.5">
            {playlists.map(pl => (
              <Link href="/library" key={pl}>
                <button 
                  onClick={() => setActiveFilter({ type: 'playlist', value: pl })}
                  className={`w-full flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-md transition-colors ${pathname === '/library' && activeFilter.type === 'playlist' && activeFilter.value === pl ? 'bg-zinc-900 text-white' : 'text-zinc-400 hover:bg-zinc-900/50 hover:text-white'}`}
                >
                  <ListMusic className="w-4 h-4" />
                  {pl}
                </button>
              </Link>
            ))}
          </div>
        </div>

        {/* Genres */}
        <div>
          <h2 className="px-3 mb-2 text-xs font-semibold text-zinc-500 uppercase tracking-wider">Genres</h2>
          <div className="space-y-0.5">
            {genres.map(g => (
              <Link href="/library" key={g}>
                <button 
                  onClick={() => setActiveFilter({ type: 'genre', value: g })}
                  className={`w-full flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-md transition-colors ${pathname === '/library' && activeFilter.type === 'genre' && activeFilter.value === g ? 'bg-zinc-900 text-white' : 'text-zinc-400 hover:bg-zinc-900/50 hover:text-white'}`}
                >
                  <Disc3 className="w-4 h-4" />
                  {g}
                </button>
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* User / Team Status */}
      <div className="p-4 border-t border-zinc-900 mt-auto">
        <div className="flex items-center gap-3 px-2 py-2 rounded-md bg-zinc-900/50 border border-zinc-800/50">
          <div className="relative flex h-2.5 w-2.5 ml-1">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-zinc-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-zinc-300"></span>
          </div>
          <div className="flex flex-col">
            <span className="text-xs font-medium text-white">3 DJs Online</span>
            <span className="text-[10px] text-zinc-500">Shared Archive Active</span>
          </div>
        </div>
      </div>
    </aside>
  );
}
