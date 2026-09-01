"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutGrid, Library, ListMusic, Disc3, Lock } from "lucide-react";
import { genres } from "@/lib/data";
import { usePlayer } from "@/components/providers/player-provider";
import { usePlaylists } from "@/components/providers/playlist-provider";
import { useAuth } from "@/components/providers/auth-provider";
import { AuroraText } from "@/components/ui/aurora-text";
import { ProfileMenu } from "@/components/layout/profile-menu";
import { CreatePlaylistDialog } from "@/components/views/create-playlist-dialog";

export function Sidebar({ isMobile = false }: { isMobile?: boolean }) {
  const { activeFilter, setActiveFilter } = usePlayer();
  const { playlists, playlistsLoading } = usePlaylists();
  const { user } = useAuth();
  const pathname = usePathname();
  const canCreatePlaylist = user?.role === 'EDITOR' || user?.role === 'ADMIN';
  // Subscribed playlists show in the sidebar, plus the user's own playlists regardless of
  // subscription state (an owner can unsubscribe from their own playlist server-side without
  // losing access to it — it should still be reachable from their sidebar). The rest of
  // `playlists` (e.g. public ones the user hasn't subscribed to and doesn't own) still exists for
  // the "Add to Playlist" submenu (see add-to-playlist-menu.tsx).
  const sidebarPlaylists = playlists.filter(pl => pl.subscribed || pl.ownerUsername === user?.username);
  return (
    <aside className={`w-64 border-r border-zinc-900 bg-black flex-col z-20 shrink-0 h-full ${isMobile ? 'flex' : 'hidden md:flex'}`}>
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
          <Link href="/overview">
            <button 
              className={`w-full flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-md transition-colors ${pathname === '/overview' ? 'bg-zinc-900 text-white' : 'text-zinc-400 hover:bg-zinc-900/50 hover:text-white'}`}
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
            {canCreatePlaylist && <CreatePlaylistDialog />}
          </div>
          <div className="space-y-0.5">
            {sidebarPlaylists.map(pl => (
              <Link key={pl.id} href={`/playlist/${pl.id}`}>
                <button
                  className={`w-full flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-md transition-colors ${pathname === `/playlist/${pl.id}` ? 'bg-zinc-900 text-white' : 'text-zinc-400 hover:bg-zinc-900/50 hover:text-white'}`}
                >
                  <ListMusic className="w-4 h-4 shrink-0" />
                  <span className="truncate flex-1 text-left">{pl.name}</span>
                  {!pl.isPublic && <Lock className="w-3 h-3 shrink-0 text-zinc-600" />}
                </button>
              </Link>
            ))}
            {playlistsLoading && (
              <div className="px-3 py-2 text-xs text-zinc-600">Loading…</div>
            )}
            {!playlistsLoading && sidebarPlaylists.length === 0 && (
              <div className="px-3 py-2 text-xs text-zinc-600">No playlists yet</div>
            )}
          </div>
        </div>

        {/* Genres — not modeled by the backend yet, shown as a preview of what's coming */}
        <div>
          <div className="flex items-center justify-between px-3 mb-2">
            <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Genres</h2>
            <span className="text-[9px] font-bold text-zinc-600 uppercase tracking-wider">Soon</span>
          </div>
          <div className="space-y-0.5">
            {genres.map(g => (
              <div
                key={g}
                title="Genres aren't supported by the backend yet"
                className="w-full flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-md text-zinc-500 hover:text-zinc-400 hover:bg-zinc-900/30 transition-colors cursor-not-allowed"
              >
                <Disc3 className="w-4 h-4" />
                {g}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* User / Session Status */}
      <div className="p-4 border-t border-zinc-900 mt-auto">
        <ProfileMenu />
      </div>
    </aside>
  );
}
