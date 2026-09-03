"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, AlertCircle } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/components/providers/auth-provider";
import { usePlaylists } from "@/components/providers/playlist-provider";
import { ApiError, playlistsApi } from "@/lib/api";

interface DeletePlaylistDialogProps {
  playlistId: number;
  playlistName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function DeletePlaylistDialog({ playlistId, playlistName, open, onOpenChange }: DeletePlaylistDialogProps) {
  const { token } = useAuth();
  const { refreshPlaylists } = usePlaylists();
  const router = useRouter();
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDelete = async () => {
    if (!token) return;
    setIsDeleting(true);
    setError(null);
    try {
      await playlistsApi.delete(playlistId, token);
      await refreshPlaylists();
      onOpenChange(false);
      router.push("/library");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Deletion failed. Please try again.");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(val) => { if (!isDeleting) onOpenChange(val); if (!val) setError(null); }}>
      <DialogContent className="bg-zinc-950 border-zinc-900 text-white sm:max-w-sm rounded-xl p-6">
        <DialogHeader className="mb-4">
          <DialogTitle className="text-xl font-semibold">Delete Playlist</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-zinc-300">
          Are you sure you want to delete <span className="font-medium text-white">{playlistName}</span>?
          This removes it for everyone, including its subscribers. This action cannot be undone.
        </p>
        {error && (
          <p className="text-sm text-red-400 mt-3 flex items-center gap-2" role="alert">
            <AlertCircle className="w-4 h-4 shrink-0" />
            {error}
          </p>
        )}
        <DialogFooter className="mt-6 gap-2">
          <Button
            onClick={() => onOpenChange(false)}
            disabled={isDeleting}
            variant="ghost"
            className="text-zinc-400 hover:text-white hover:bg-zinc-900"
          >
            Cancel
          </Button>
          <Button
            onClick={handleDelete}
            disabled={isDeleting}
            className="bg-red-600 hover:bg-red-700 text-white"
          >
            {isDeleting ? <Loader2 className="w-5 h-5 animate-spin" /> : "Delete"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
