"use client";

import { useRef, useState } from "react";
import { CloudUpload, Loader2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { usePlayer } from "@/components/providers/player-provider";
import { useAuth } from "@/components/providers/auth-provider";
import { useGenres } from "@/components/providers/genre-provider";
import { ApiError, tracksApi } from "@/lib/api";

const ACCEPTED_EXTENSIONS = [".mp3", ".wav"];
const MAX_FILE_SIZE = 200 * 1024 * 1024;

function formatFileSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function UploadDialog() {
  const { token } = useAuth();
  const { refreshTracks } = usePlayer();
  const { refreshGenres } = useGenres();
  const [open, setOpen] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const resetState = () => {
    setSelectedFiles([]);
    setError(null);
    setIsDragging(false);
    setProgress(0);
  };

  const validateAndAddFiles = (files: FileList | File[]) => {
    const validFiles: File[] = [];
    let hasError = false;
    Array.from(files).forEach(file => {
      const lowerName = file.name.toLowerCase();
      if (!ACCEPTED_EXTENSIONS.some(ext => lowerName.endsWith(ext))) {
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

  const handleUpload = async () => {
    if (selectedFiles.length === 0 || !token) return;
    setIsUploading(true);
    setError(null);
    setProgress(0);
    try {
      for (let i = 0; i < selectedFiles.length; i++) {
        await tracksApi.upload(selectedFiles[i], token);
        setProgress(i + 1);
      }
      await refreshTracks();
      await refreshGenres();
      setOpen(false);
      resetState();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Upload failed. Please try again.");
    } finally {
      setIsUploading(false);
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
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setIsDragging(false);
              if (e.dataTransfer.files) validateAndAddFiles(e.dataTransfer.files);
            }}
            className={`border border-dashed rounded-xl p-10 flex flex-col items-center justify-center text-center gap-4 transition-all cursor-pointer group bg-black/50 ${isDragging ? 'border-zinc-400 bg-zinc-900/80' : 'border-zinc-700 hover:border-zinc-500 hover:bg-zinc-900/80'}`}
          >
            <div className="w-10 h-10 rounded-full bg-zinc-900 flex items-center justify-center border border-zinc-800 group-hover:bg-zinc-800 transition-colors">
              <CloudUpload className="w-5 h-5 text-zinc-400 group-hover:text-white" />
            </div>
            {selectedFiles.length > 0 ? (
              <div>
                <p className="text-sm font-medium text-zinc-200">{selectedFiles.length} file(s) selected</p>
                <p className="text-xs text-zinc-600 mt-1">Total size: {formatFileSize(selectedFiles.reduce((acc, f) => acc + f.size, 0))} · Click to add more</p>
              </div>
            ) : (
              <div>
                <p className="text-sm font-medium text-zinc-300">Drag & drop a file, or click to browse</p>
                <p className="text-xs text-zinc-600 mt-1">MP3 or WAV (max 200MB)</p>
              </div>
            )}
          </div>
          {error && (
            <p className="text-sm text-red-400 mt-4 flex items-center gap-2" role="alert">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {error}
            </p>
          )}
        </div>
        <DialogFooter className="mt-8">
          <Button
            onClick={handleUpload}
            disabled={selectedFiles.length === 0 || isUploading}
            className="w-full bg-white hover:bg-zinc-200 text-black rounded-md h-12 text-sm font-bold tracking-widest uppercase disabled:opacity-50"
          >
            {isUploading ? (
              <span className="flex items-center gap-2">
                <Loader2 className="w-5 h-5 animate-spin" /> Uploading ({progress}/{selectedFiles.length})
              </span>
            ) : "Upload to Shared Library"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
