"use client";

import { useState } from "react";
import { ListMusic, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/components/providers/auth-provider";
import { usePlaylists } from "@/components/providers/playlist-provider";
import { ApiError, playlistsApi } from "@/lib/api";

interface BulkAddToPlaylistMenuProps {
  trackIds: number[];
}

/**
 * Standalone toolbar version of `AddToPlaylistMenu` for a multi-select bulk action. Unlike the
 * per-track menu, this shows no membership checkmarks — with many tracks selected, aggregate
 * membership isn't meaningfully representable as a single checkmark per playlist.
 */
export function BulkAddToPlaylistMenu({ trackIds }: BulkAddToPlaylistMenuProps) {
  const { user, token } = useAuth();
  const { playlists } = usePlaylists();
  const [pendingPlaylistIds, setPendingPlaylistIds] = useState<Set<number>>(new Set());

  const editablePlaylists = playlists.filter(p =>
    (p.isPublic || p.ownerUsername === user?.username) &&
    (p.subscribed || p.ownerUsername === user?.username)
  );

  const handleAdd = async (playlistId: number) => {
    if (!token || trackIds.length === 0) return;
    setPendingPlaylistIds(prev => new Set(prev).add(playlistId));
    try {
      await playlistsApi.bulkAddTracks(playlistId, trackIds, token);
    } catch (err) {
      console.error(err instanceof ApiError ? err.message : err);
    } finally {
      setPendingPlaylistIds(prev => {
        const next = new Set(prev);
        next.delete(playlistId);
        return next;
      });
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={
        <Button
          variant="ghost"
          size="sm"
          disabled={trackIds.length === 0}
          className="text-zinc-400 hover:text-white hover:bg-zinc-800/50"
        >
          <ListMusic className="w-4 h-4 mr-1.5" /> Add to Playlist
        </Button>
      } />
      <DropdownMenuContent align="start" className="w-52 bg-zinc-950 border-zinc-800 text-zinc-300 rounded-lg p-1 shadow-2xl">
        {editablePlaylists.length === 0 && (
          <DropdownMenuItem disabled className="py-2 text-sm text-zinc-500">
            No playlists
          </DropdownMenuItem>
        )}
        {editablePlaylists.map(playlist => (
          <DropdownMenuItem
            key={playlist.id}
            closeOnClick={false}
            disabled={pendingPlaylistIds.has(playlist.id)}
            onClick={() => handleAdd(playlist.id)}
            className="focus:!bg-zinc-800 focus:!text-white hover:!bg-zinc-800 hover:!text-white cursor-pointer rounded-md py-2"
          >
            {pendingPlaylistIds.has(playlist.id) ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin shrink-0" />
            ) : null}
            <span className="text-sm truncate">{playlist.name}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
