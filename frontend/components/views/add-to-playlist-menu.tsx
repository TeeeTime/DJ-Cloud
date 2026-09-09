"use client";

import { useState } from "react";
import { ListMusic } from "lucide-react";
import {
  DropdownMenuCheckboxItem,
  DropdownMenuItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/components/providers/auth-provider";
import { usePlaylists } from "@/components/providers/playlist-provider";
import { ApiError, playlistsApi } from "@/lib/api";

interface AddToPlaylistMenuProps {
  trackId: number;
}

export function AddToPlaylistMenu({ trackId }: AddToPlaylistMenuProps) {
  const { user, token } = useAuth();
  const { playlists } = usePlaylists();

  const [memberPlaylistIds, setMemberPlaylistIds] = useState<Set<number> | null>(null);
  const [pendingPlaylistIds, setPendingPlaylistIds] = useState<Set<number>>(new Set());

  const canUpload = user?.role === 'EDITOR' || user?.role === 'ADMIN';
  if (!canUpload) return null;

  // Editable (public, or owned) AND something the user actually keeps in their own list (owned,
  // or subscribed) — same "owned or subscribed" rule the sidebar uses, so this submenu only ever
  // offers playlists the user would recognize from there.
  const editablePlaylists = playlists.filter(p =>
    (p.isPublic || p.ownerUsername === user?.username) &&
    (p.subscribed || p.ownerUsername === user?.username)
  );

  const handleOpenChange = async (open: boolean) => {
    if (!open || !token) return;
    try {
      const ids = await playlistsApi.playlistIdsForTrack(trackId, token);
      setMemberPlaylistIds(new Set(ids));
    } catch (err) {
      console.error(err instanceof ApiError ? err.message : err);
    }
  };

  const handleToggle = async (playlistId: number, adding: boolean) => {
    if (!token) return;
    setPendingPlaylistIds(prev => new Set(prev).add(playlistId));
    try {
      if (adding) {
        await playlistsApi.addTrack(playlistId, trackId, token);
      } else {
        await playlistsApi.removeTrack(playlistId, trackId, token);
      }
      setMemberPlaylistIds(prev => {
        const next = new Set(prev);
        if (adding) next.add(playlistId);
        else next.delete(playlistId);
        return next;
      });
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
    <DropdownMenuSub onOpenChange={handleOpenChange}>
      <DropdownMenuSubTrigger className="focus:!bg-zinc-800 focus:!text-white hover:!bg-zinc-800 hover:!text-white cursor-pointer rounded-md py-2">
        <ListMusic className="w-4 h-4 mr-2" /> <span className="text-sm">Add to Playlist</span>
      </DropdownMenuSubTrigger>
      <DropdownMenuSubContent className="bg-zinc-950 border-zinc-800 text-zinc-300 rounded-lg p-1 shadow-2xl">
        {editablePlaylists.length === 0 && (
          <DropdownMenuItem disabled className="py-2 text-sm text-zinc-500">
            No playlists
          </DropdownMenuItem>
        )}
        {editablePlaylists.map(playlist => (
          <DropdownMenuCheckboxItem
            key={playlist.id}
            checked={memberPlaylistIds?.has(playlist.id) ?? false}
            disabled={pendingPlaylistIds.has(playlist.id)}
            closeOnClick={false}
            onCheckedChange={checked => handleToggle(playlist.id, checked)}
            className="focus:!bg-zinc-800 focus:!text-white hover:!bg-zinc-800 hover:!text-white cursor-pointer rounded-md py-2"
          >
            <span className="text-sm truncate">{playlist.name}</span>
          </DropdownMenuCheckboxItem>
        ))}
      </DropdownMenuSubContent>
    </DropdownMenuSub>
  );
}
