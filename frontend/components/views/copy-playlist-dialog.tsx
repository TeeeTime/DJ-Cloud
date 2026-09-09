"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, AlertCircle } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { useAuth } from "@/components/providers/auth-provider";
import { usePlaylists } from "@/components/providers/playlist-provider";
import { ApiError, playlistsApi } from "@/lib/api";

interface CopyPlaylistDialogProps {
  sourcePlaylistId: number;
  sourceName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CopyPlaylistDialog({
  sourcePlaylistId,
  sourceName,
  open,
  onOpenChange,
}: CopyPlaylistDialogProps) {
  const { token } = useAuth();
  const { refreshPlaylists } = usePlaylists();
  const router = useRouter();

  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [isPublic, setIsPublic] = useState(false);

  // Resets the form fields whenever the dialog opens — done during render, not in an effect, per
  // https://react.dev/learn/you-might-not-need-an-effect (mirrors EditPlaylistDialog). The copy
  // always starts Private regardless of the source's own visibility.
  const [initializedFor, setInitializedFor] = useState(false);
  if (open && !initializedFor) {
    setInitializedFor(true);
    setName(`${sourceName} (Copy)`);
    setIsPublic(false);
    setError(null);
  } else if (!open && initializedFor) {
    setInitializedFor(false);
  }

  const handleCopy = async () => {
    if (!token || !name.trim()) return;
    setIsSaving(true);
    setError(null);
    try {
      const created = await playlistsApi.copy(sourcePlaylistId, name.trim(), isPublic, token);
      await refreshPlaylists();
      onOpenChange(false);
      router.push(`/playlist/${created.id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not copy playlist. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(val) => { if (!isSaving) onOpenChange(val); }}>
      <DialogContent className="bg-zinc-950 border-zinc-900 text-white sm:max-w-sm rounded-xl p-6">
        <DialogHeader className="mb-6">
          <DialogTitle className="text-xl font-semibold">Copy Playlist</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <label className="text-xs font-medium text-zinc-400 uppercase tracking-wider mb-1.5 block">Name</label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="bg-zinc-900/50 border-zinc-800 focus-visible:ring-1 focus-visible:ring-zinc-700 h-10"
            />
          </div>
          <div className="flex items-center justify-between">
            <label className="text-sm text-zinc-300">Public</label>
            <Switch checked={isPublic} onCheckedChange={setIsPublic} />
          </div>
          {error && (
            <p className="text-sm text-red-400 flex items-center gap-2" role="alert">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {error}
            </p>
          )}
        </div>
        <DialogFooter className="mt-8 gap-2">
          <Button
            onClick={() => onOpenChange(false)}
            disabled={isSaving}
            variant="ghost"
            className="text-zinc-400 hover:text-white hover:bg-zinc-900"
          >
            Cancel
          </Button>
          <Button
            onClick={handleCopy}
            disabled={isSaving || !name.trim()}
            className="bg-white hover:bg-zinc-200 text-black font-medium"
          >
            {isSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : "Create Copy"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
