"use client";

import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Track } from "@/lib/data";
import { useAuth } from "@/components/providers/auth-provider";
import { tracksApi, ApiError } from "@/lib/api";
import { Loader2, AlertCircle } from "lucide-react";
import { usePlayer } from "@/components/providers/player-provider";
import { useGenres } from "@/components/providers/genre-provider";

interface TrackDeleteDialogProps {
  track: Track | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function TrackDeleteDialog({ track, open, onOpenChange }: TrackDeleteDialogProps) {
  const { token } = useAuth();
  const { refreshTracks } = usePlayer();
  const { refreshGenres } = useGenres();
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDelete = async () => {
    if (!track || !token) return;
    setIsDeleting(true);
    setError(null);
    try {
      await tracksApi.delete(track.id, token);
      await refreshTracks();
      await refreshGenres();
      onOpenChange(false);
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
          <DialogTitle className="text-xl font-semibold">Delete Track</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-zinc-300">
          Are you sure you want to delete <span className="font-medium text-white">{track?.title}</span>?
          This action cannot be undone.
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
