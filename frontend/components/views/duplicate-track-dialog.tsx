"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { DuplicateTrackResponse } from "@/lib/api";
import { AlertTriangle } from "lucide-react";

interface DuplicateTrackDialogProps {
  fileName: string;
  match: DuplicateTrackResponse;
  onSkip: () => void;
  onConfirm: () => void;
}

export function DuplicateTrackDialog({ fileName, match, onSkip, onConfirm }: DuplicateTrackDialogProps) {
  const { existingTrack } = match;
  const artist = existingTrack.artists[0];

  const description =
    match.reason === "EXACT_FILE"
      ? <>This file looks identical to <span className="font-medium text-white">{existingTrack.title}</span>{artist ? <> by <span className="font-medium text-white">{artist}</span></> : null}, already in the library.</>
      : <>A track titled <span className="font-medium text-white">{existingTrack.title}</span>{artist ? <> by <span className="font-medium text-white">{artist}</span></> : null} is already in the library.</>;

  return (
    <Dialog open onOpenChange={(next) => { if (!next) onSkip(); }}>
      <DialogContent className="bg-zinc-950 border-zinc-900 text-white sm:max-w-md rounded-xl p-6">
        <DialogHeader className="mb-4">
          <DialogTitle className="text-xl font-semibold flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-yellow-500 shrink-0" />
            Possible Duplicate
          </DialogTitle>
        </DialogHeader>
        <p className="text-sm text-zinc-400 mb-2 truncate">{fileName}</p>
        <p className="text-sm text-zinc-300">{description}</p>
        <DialogFooter className="mt-6 gap-2">
          <Button onClick={onSkip} variant="ghost" className="text-zinc-400 hover:text-white hover:bg-zinc-900">
            Skip
          </Button>
          <Button onClick={onConfirm} className="bg-white hover:bg-zinc-200 text-black">
            Upload Anyway
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
