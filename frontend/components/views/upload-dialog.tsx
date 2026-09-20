"use client";

import { useRef, useState } from "react";
import { CloudUpload, Loader2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { DuplicateTrackDialog } from "@/components/views/duplicate-track-dialog";
import { usePlayer } from "@/components/providers/player-provider";
import { useAuth } from "@/components/providers/auth-provider";
import { useGenres } from "@/components/providers/genre-provider";
import { usePlaylists } from "@/components/providers/playlist-provider";
import { ApiError, DuplicateTrackResponse, playlistsApi, tracksApi } from "@/lib/api";
import {
  MAX_FILE_SIZE,
  buildFolderBatch,
  collectDroppedEntries,
  fileEntryToFile,
  hasAudioExtension,
  type FolderBatch,
} from "@/lib/folder-drop";

interface FolderBatchResult {
  folderName: string;
  playlistId: number | null;
  created: number;
  existing: number;
  failed: number;
  failedNames: string[];
  skippedEmpty: boolean;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function isDuplicateTrackResponse(body: unknown): body is DuplicateTrackResponse {
  return !!body && typeof body === "object" && "reason" in body && "existingTrack" in body;
}

export function UploadDialog() {
  const { token } = useAuth();
  const { refreshTracks } = usePlayer();
  const { refreshGenres } = useGenres();
  const { refreshPlaylists } = usePlaylists();
  const [open, setOpen] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [skippedCount, setSkippedCount] = useState(0);
  const [pendingDuplicate, setPendingDuplicate] = useState<{ file: File; match: DuplicateTrackResponse } | null>(null);
  const [folderBatches, setFolderBatches] = useState<FolderBatch[]>([]);
  const [isScanningFolder, setIsScanningFolder] = useState(false);
  const [folderProgress, setFolderProgress] = useState<{
    batchIndex: number;
    batchTotal: number;
    folderName: string;
    fileIndex: number;
    fileTotal: number;
  } | null>(null);
  const [folderResults, setFolderResults] = useState<FolderBatchResult[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const duplicateResolverRef = useRef<((choice: "skip" | "confirm") => void) | null>(null);

  const resetState = () => {
    setSelectedFiles([]);
    setError(null);
    setIsDragging(false);
    setProgress(0);
    setSkippedCount(0);
    setPendingDuplicate(null);
    setFolderBatches([]);
    setIsScanningFolder(false);
    setFolderProgress(null);
    setFolderResults([]);
  };

  const validateAndAddFiles = (files: FileList | File[]) => {
    const validFiles: File[] = [];
    let hasError = false;
    Array.from(files).forEach(file => {
      if (!hasAudioExtension(file.name)) {
        hasError = true;
      } else if (file.size > MAX_FILE_SIZE) {
        hasError = true;
      } else {
        validFiles.push(file);
      }
    });

    if (hasError) {
      setError("Some files were ignored (unsupported type or too large).");
    } else {
      setError(null);
    }

    setSelectedFiles(prev => [...prev, ...validFiles]);
  };

  const uploadFolderBatch = async (
    batch: FolderBatch,
    batchIndex: number,
    batchTotal: number,
    authToken: string
  ): Promise<FolderBatchResult> => {
    if (batch.files.length === 0) {
      return { folderName: batch.folderName, playlistId: null, created: 0, existing: 0, failed: 0, failedNames: [], skippedEmpty: true };
    }

    const playlist = await playlistsApi.create(batch.folderName, false, authToken);

    let created = 0;
    let existing = 0;
    let failed = 0;
    const failedNames: string[] = [];

    for (let i = 0; i < batch.files.length; i++) {
      const file = batch.files[i];
      setFolderProgress({ batchIndex, batchTotal, folderName: batch.folderName, fileIndex: i + 1, fileTotal: batch.files.length });
      try {
        const track = await tracksApi.upload(file, authToken, false);
        await playlistsApi.addTrack(playlist.id, track.id, authToken);
        created += 1;
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) throw err;
        if (err instanceof ApiError && err.status === 409 && isDuplicateTrackResponse(err.body)) {
          try {
            await playlistsApi.addTrack(playlist.id, err.body.existingTrack.id, authToken);
            existing += 1;
          } catch {
            failed += 1;
            failedNames.push(file.name);
          }
        } else {
          failed += 1;
          failedNames.push(file.name);
        }
      }
    }

    if (created === 0 && existing === 0) {
      try {
        await playlistsApi.delete(playlist.id, authToken);
      } catch {
        // best-effort cleanup of an empty playlist
      }
      return { folderName: batch.folderName, playlistId: null, created, existing, failed, failedNames, skippedEmpty: false };
    }

    return { folderName: batch.folderName, playlistId: playlist.id, created, existing, failed, failedNames, skippedEmpty: false };
  };

  const handleUpload = async () => {
    const hasUploadableContent = selectedFiles.length > 0 || folderBatches.some(b => b.files.length > 0);
    if (!hasUploadableContent || !token) return;
    setIsUploading(true);
    setError(null);
    setProgress(0);
    setSkippedCount(0);
    setFolderResults([]);
    let skipped = 0;
    try {
      for (let i = 0; i < selectedFiles.length; i++) {
        const file = selectedFiles[i];
        let confirmDuplicate = false;
        for (;;) {
          try {
            await tracksApi.upload(file, token, confirmDuplicate);
            break;
          } catch (err) {
            if (err instanceof ApiError && err.status === 409 && isDuplicateTrackResponse(err.body)) {
              const match = err.body;
              const choice = await new Promise<"skip" | "confirm">(resolve => {
                duplicateResolverRef.current = resolve;
                setPendingDuplicate({ file, match });
              });
              setPendingDuplicate(null);
              if (choice === "skip") {
                skipped += 1;
                setSkippedCount(skipped);
                break;
              }
              confirmDuplicate = true;
              continue;
            }
            throw err;
          }
        }
        setProgress(i + 1);
      }

      const results: FolderBatchResult[] = [];
      for (let b = 0; b < folderBatches.length; b++) {
        try {
          results.push(await uploadFolderBatch(folderBatches[b], b, folderBatches.length, token));
        } catch (err) {
          if (err instanceof ApiError && err.status === 401) throw err;
          results.push({
            folderName: folderBatches[b].folderName,
            playlistId: null,
            created: 0,
            existing: 0,
            failed: folderBatches[b].files.length,
            failedNames: folderBatches[b].files.map(f => f.name),
            skippedEmpty: false,
          });
        }
      }
      setFolderResults(results);
      setFolderProgress(null);

      await refreshTracks();
      await refreshGenres();
      await refreshPlaylists();

      const folderHadIssues = results.some(r => r.failed > 0 || r.skippedEmpty || r.playlistId === null);
      if (skipped === 0 && !folderHadIssues) {
        setOpen(false);
        resetState();
      } else {
        setSelectedFiles([]);
        setFolderBatches([]);
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Upload failed. Please try again.");
    } finally {
      setIsUploading(false);
      setFolderProgress(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => { setOpen(next); if (!next) resetState(); }}>
      <DialogTrigger render={
        <Button className="bg-white hover:bg-zinc-200 text-black gap-2 h-10 px-5 rounded-md font-medium transition-colors">
          <CloudUpload className="w-4 h-4" />
          Upload
        </Button>
      } />
      <DialogContent className="bg-zinc-950 border-zinc-900 text-white sm:max-w-md rounded-xl p-6">
        <DialogHeader className="mb-6">
          <DialogTitle className="text-xl font-semibold">Add to Archive</DialogTitle>
        </DialogHeader>
        <div className="py-2">
          <input
            ref={fileInputRef}
            type="file"
            accept=".mp3,.wav"
            multiple
            className="hidden"
            onChange={(e) => {
              if (e.target.files) validateAndAddFiles(e.target.files);
              e.target.value = "";
            }}
          />
          <div
            onClick={() => { if (!isScanningFolder) fileInputRef.current?.click(); }}
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={async (e) => {
              e.preventDefault();
              setIsDragging(false);
              const { fileEntries, dirEntries, supported } = collectDroppedEntries(e.dataTransfer);
              if (!supported) {
                if (e.dataTransfer.files) validateAndAddFiles(e.dataTransfer.files);
                return;
              }
              if (fileEntries.length > 0) {
                const files = await Promise.all(fileEntries.map(fileEntryToFile));
                validateAndAddFiles(files);
              }
              if (dirEntries.length > 0) {
                setIsScanningFolder(true);
                try {
                  const newBatches = await Promise.all(dirEntries.map(buildFolderBatch));
                  setFolderBatches(prev => [...prev, ...newBatches]);
                } finally {
                  setIsScanningFolder(false);
                }
              }
            }}
            className={`border border-dashed rounded-xl p-10 flex flex-col items-center justify-center text-center gap-4 transition-all cursor-pointer group bg-black/50 ${isDragging ? 'border-zinc-400 bg-zinc-900/80' : 'border-zinc-700 hover:border-zinc-500 hover:bg-zinc-900/80'}`}
          >
            <div className="w-10 h-10 rounded-full bg-zinc-900 flex items-center justify-center border border-zinc-800 group-hover:bg-zinc-800 transition-colors">
              <CloudUpload className="w-5 h-5 text-zinc-400 group-hover:text-white" />
            </div>
            {isScanningFolder ? (
              <p className="text-sm font-medium text-zinc-300">Scanning folder…</p>
            ) : selectedFiles.length > 0 || folderBatches.length > 0 ? (
              <div className="space-y-1">
                {selectedFiles.length > 0 && (
                  <p className="text-sm font-medium text-zinc-200">{selectedFiles.length} file(s) selected</p>
                )}
                {folderBatches.map(batch => (
                  <p key={batch.id} className="text-sm font-medium text-zinc-200">
                    &quot;{batch.folderName}&quot; folder — {batch.files.length} track{batch.files.length === 1 ? "" : "s"}
                    {batch.files.length === 0 ? " (no audio files found)" : ""}
                    {batch.oversizedNames.length > 0 ? `, ${batch.oversizedNames.length} too large (skipped)` : ""}
                  </p>
                ))}
                <p className="text-xs text-zinc-600 mt-1">
                  Total size: {formatFileSize(
                    selectedFiles.reduce((acc, f) => acc + f.size, 0) +
                    folderBatches.reduce((acc, b) => acc + b.files.reduce((sum, f) => sum + f.size, 0), 0)
                  )} · Click to add more, or drag a folder to create a playlist
                </p>
              </div>
            ) : (
              <div>
                <p className="text-sm font-medium text-zinc-300">Drag & drop files or a folder, or click to browse</p>
                <p className="text-xs text-zinc-600 mt-1">MP3 or WAV (max 200MB) · Drop a folder to upload it as a playlist</p>
              </div>
            )}
          </div>
          {error && (
            <p className="text-sm text-red-400 mt-4 flex items-center gap-2" role="alert">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {error}
            </p>
          )}
          {!isUploading && (skippedCount > 0 || folderResults.length > 0) && (
            <div className="text-sm text-zinc-400 mt-4 space-y-1">
              {skippedCount > 0 && (
                <p>{skippedCount} duplicate file{skippedCount === 1 ? "" : "s"} skipped. The rest were uploaded.</p>
              )}
              {folderResults.map(result => (
                <p key={result.folderName}>
                  {result.skippedEmpty
                    ? `"${result.folderName}" had no audio files — skipped.`
                    : result.playlistId === null
                    ? `"${result.folderName}" — upload failed, no playlist created.`
                    : `Playlist "${result.folderName}" created — ${result.created} new, ${result.existing} already in library${result.failed > 0 ? `, ${result.failed} failed` : ""}.`}
                </p>
              ))}
            </div>
          )}
        </div>
        <DialogFooter className="mt-8">
          <Button
            onClick={handleUpload}
            disabled={(selectedFiles.length === 0 && folderBatches.every(b => b.files.length === 0)) || isUploading || isScanningFolder}
            className="w-full bg-white hover:bg-zinc-200 text-black rounded-md h-12 text-sm font-bold tracking-widest uppercase disabled:opacity-50"
          >
            {isUploading ? (
              <span className="flex items-center gap-2">
                <Loader2 className="w-5 h-5 animate-spin" />
                {folderProgress
                  ? `Folder ${folderProgress.batchIndex + 1}/${folderProgress.batchTotal} — "${folderProgress.folderName}" (${folderProgress.fileIndex}/${folderProgress.fileTotal})`
                  : `Uploading (${progress}/${selectedFiles.length})`}
              </span>
            ) : "Upload to Shared Library"}
          </Button>
        </DialogFooter>
      </DialogContent>
      {pendingDuplicate && (
        <DuplicateTrackDialog
          fileName={pendingDuplicate.file.name}
          match={pendingDuplicate.match}
          onSkip={() => duplicateResolverRef.current?.("skip")}
          onConfirm={() => duplicateResolverRef.current?.("confirm")}
        />
      )}
    </Dialog>
  );
}
