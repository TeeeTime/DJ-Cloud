"use client";

import { ListMusic } from "lucide-react";
import {
  DropdownMenuItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/components/providers/auth-provider";
import { usePlaylists } from "@/components/providers/playlist-provider";
import { playlistsApi } from "@/lib/api";

interface AddToPlaylistMenuProps {
  trackId: number;
}

export function AddToPlaylistMenu({ trackId }: AddToPlaylistMenuProps) {
  const { user, token } = useAuth();
  const { playlists } = usePlaylists();

  const canUpload = user?.role === 'EDITOR' || user?.role === 'ADMIN';
  if (!canUpload) return null;

  // Editable (public, or owned) AND something the user actually keeps in their own list (owned,
  // or subscribed) — same "owned or subscribed" rule the sidebar uses, so this submenu only ever
  // offers playlists the user would recognize from there.
  const editablePlaylists = playlists.filter(p =>
    (p.isPublic || p.ownerUsername === user?.username) &&
    (p.subscribed || p.ownerUsername === user?.username)
  );

  return (
    <DropdownMenuSub>
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
          <DropdownMenuItem
            key={playlist.id}
            onClick={() => {
              if (token) playlistsApi.addTrack(playlist.id, trackId, token);
            }}
            className="focus:!bg-zinc-800 focus:!text-white hover:!bg-zinc-800 hover:!text-white cursor-pointer rounded-md py-2"
          >
            <span className="text-sm truncate">{playlist.name}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuSubContent>
    </DropdownMenuSub>
  );
}
