"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { Search, Globe, Lock, Loader2, AlertCircle, Menu } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";
import { usePlaylists } from "@/components/providers/playlist-provider";
import { useDebouncedValue } from "@/lib/use-debounced-value";
import { Sidebar } from "@/components/layout/sidebar";

export function PlaylistBrowserView() {
  const { playlists, playlistsLoading, playlistsError } = usePlaylists();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const debouncedQuery = useDebouncedValue(searchQuery, 150);

  const filteredPlaylists = useMemo(() => {
    const q = debouncedQuery.trim().toLowerCase();
    if (!q) return playlists;
    return playlists.filter(pl =>
      pl.name.toLowerCase().includes(q) ||
      pl.ownerUsername.toLowerCase().includes(q) ||
      pl.topGenres.some(genre => genre.toLowerCase().includes(q))
    );
  }, [playlists, debouncedQuery]);

  return (
    <main className="flex-1 flex flex-col min-w-0 bg-zinc-950/30 relative h-full">
      {/* Header */}
      <header className="h-20 flex items-center justify-between px-4 md:px-8 border-b border-zinc-900 bg-black/50 backdrop-blur-xl sticky top-0 z-10 shrink-0 gap-4">
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

          <div className="relative w-full max-w-md group">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 group-focus-within:text-white transition-colors" />
            <Input
              placeholder="Search playlists..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 bg-black border-zinc-800 text-white focus-visible:ring-1 focus-visible:ring-zinc-700 focus-visible:border-zinc-700 transition-all rounded-md h-10 placeholder:text-zinc-600"
            />
          </div>
        </div>
      </header>

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto pb-6">
        <div className="px-8 py-8">
          <h2 className="text-3xl font-bold text-white mb-8 tracking-tight">
            All Playlists
          </h2>

          {playlistsError && (
            <div className="mb-6 flex items-center gap-2 text-sm text-red-400 border border-red-950 bg-red-950/20 rounded-lg px-4 py-3">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {playlistsError}
            </div>
          )}

          {playlistsLoading ? (
            <div className="h-32 flex items-center justify-center gap-2 text-zinc-500">
              <Loader2 className="w-4 h-4 animate-spin" />
              Loading playlists…
            </div>
          ) : filteredPlaylists.length === 0 ? (
            <div className="h-32 flex items-center justify-center text-zinc-500 text-sm">
              {playlists.length === 0 ? "No playlists yet." : "No playlists match your search."}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {filteredPlaylists.map(pl => (
                <Link href={`/playlist/${pl.id}`} key={pl.id} className="block group">
                  <Card className="h-full hover:ring-foreground/20 hover:bg-zinc-900/40 transition-colors cursor-pointer">
                    <CardHeader>
                      <CardTitle className="min-w-0">
                        <span className="truncate block" title={pl.name}>{pl.name}</span>
                      </CardTitle>
                      <div className="flex items-center gap-1.5 text-xs text-zinc-500 min-w-0">
                        {pl.isPublic ? <Globe className="w-3 h-3 shrink-0" /> : <Lock className="w-3 h-3 shrink-0" />}
                        <span className="truncate" title={pl.ownerUsername}>by {pl.ownerUsername}</span>
                      </div>
                    </CardHeader>
                    <CardContent>
                      {pl.topGenres.length > 0 ? (
                        <div className="flex flex-wrap gap-1.5">
                          {pl.topGenres.map(genre => (
                            <span
                              key={genre}
                              className="text-xs text-zinc-300 border border-zinc-700 bg-zinc-800 px-2 py-0.5 rounded-full"
                            >
                              {genre}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-xs text-zinc-600">No genres tagged</span>
                      )}
                    </CardContent>
                    <CardFooter className="text-xs text-zinc-500">
                      {pl.trackCount} {pl.trackCount === 1 ? "track" : "tracks"}
                    </CardFooter>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
