"use client";

import React, { useEffect, useRef, useState } from "react";
import { Play, Pause, Download, Pencil, Trash, Settings2, CloudUpload, Search, MoreHorizontal, ArrowUpDown, ChevronUp, ChevronDown, Menu, Loader2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";
import { usePlayer } from "@/components/providers/player-provider";
import { useAuth } from "@/components/providers/auth-provider";
import { useGenres } from "@/components/providers/genre-provider";
import { Track, formatDateAdded } from "@/lib/data";
import { ApiError, tracksApi } from "@/lib/api";
import { downloadFile } from "@/lib/download";
import { Sidebar } from "@/components/layout/sidebar";
import { TrackEditDialog } from "./track-edit-dialog";
import { TrackDeleteDialog } from "./track-delete-dialog";
import { StatusBadge, TrackThumbnail } from "./track-row-parts";
import { AddToPlaylistMenu } from "./add-to-playlist-menu";

const ACCEPTED_EXTENSIONS = [".mp3", ".wav"];
const MAX_FILE_SIZE = 200 * 1024 * 1024;

function formatFileSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function UploadDialog() {
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

export function LibraryView() {
  const {
    activeFilter,
    tracks,
    tracksLoading,
    tracksLoadingMore,
    tracksError,
    hasMoreTracks,
    loadMoreTracks,
    currentTrack,
    setCurrentTrack,
    isPlaying,
    setIsPlaying,
    handleSort,
    sortConfig,
    searchQuery,
    setSearchQuery,
  } = usePlayer();
  const { user, token } = useAuth();

  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);
  const canUpload = user?.role === 'EDITOR' || user?.role === 'ADMIN';

  const [trackToEdit, setTrackToEdit] = useState<Track | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);

  const [trackToDelete, setTrackToDelete] = useState<Track | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  const [downloadingTrackId, setDownloadingTrackId] = useState<number | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  const handleDownloadTrack = async (track: Track) => {
    if (!token) return;
    setDownloadingTrackId(track.id);
    setDownloadError(null);
    try {
      await downloadFile(tracksApi.downloadUrl(track.id), token, `${track.title} - ${track.artist}.${track.format.toLowerCase()}`);
    } catch (err) {
      setDownloadError(err instanceof ApiError ? err.message : "Download failed. Please try again.");
    } finally {
      setDownloadingTrackId(null);
    }
  };

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const loadMoreRef = useRef<HTMLTableRowElement>(null);

  useEffect(() => {
    const sentinel = loadMoreRef.current;
    if (!sentinel || !hasMoreTracks) return;

    const observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) loadMoreTracks();
    }, { root: scrollContainerRef.current, rootMargin: "200px" });

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMoreTracks, loadMoreTracks]);

  const renderSortIcon = (key: keyof Track) => {
    if (sortConfig?.key !== key) return <ArrowUpDown className="w-3 h-3 ml-1 opacity-20 group-hover:opacity-100 transition-opacity" />;
    if (sortConfig.direction === 'asc') return <ChevronUp className="w-3 h-3 ml-1 text-white" />;
    return <ChevronDown className="w-3 h-3 ml-1 text-white" />;
  };

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
              placeholder="Search archive..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 bg-black border-zinc-800 text-white focus-visible:ring-1 focus-visible:ring-zinc-700 focus-visible:border-zinc-700 transition-all rounded-md h-10 placeholder:text-zinc-600"
            />
          </div>
        </div>
        {canUpload && (
          <div className="flex items-center gap-4 shrink-0">
            <UploadDialog />
          </div>
        )}
      </header>

      {/* Content Area */}
      <div ref={scrollContainerRef} className="flex-1 overflow-y-auto pb-6">
        <div className="px-8 py-8">
          <h2 className="text-3xl font-bold text-white mb-8 tracking-tight">
            {activeFilter.value}
          </h2>

          {tracksError && (
            <div className="mb-6 flex items-center gap-2 text-sm text-red-400 border border-red-950 bg-red-950/20 rounded-lg px-4 py-3">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {tracksError}
            </div>
          )}

          {downloadError && (
            <div className="mb-6 flex items-center gap-2 text-sm text-red-400 border border-red-950 bg-red-950/20 rounded-lg px-4 py-3">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {downloadError}
            </div>
          )}

          {/* Table */}
          <div className="rounded-xl border border-zinc-900 bg-black/50 overflow-hidden w-full">
            <Table className="table-fixed w-full">
              <TableHeader className="bg-zinc-900/30 select-none">
                <TableRow className="border-zinc-900 hover:bg-transparent">
                  <TableHead className="w-[4%] text-center h-11">#</TableHead>
                  <TableHead
                    className="w-[22%] text-xs font-semibold uppercase tracking-wider text-zinc-500 cursor-pointer hover:text-white transition-colors group h-11"
                    onClick={() => handleSort('title')}
                  >
                    <div className="flex items-center">Title {renderSortIcon('title')}</div>
                  </TableHead>
                  <TableHead
                    className="w-[16%] text-xs font-semibold uppercase tracking-wider text-zinc-500 cursor-pointer hover:text-white transition-colors group h-11"
                    onClick={() => handleSort('artist')}
                  >
                    <div className="flex items-center">Artist {renderSortIcon('artist')}</div>
                  </TableHead>
                  <TableHead className="w-[14%] text-xs font-semibold uppercase tracking-wider text-zinc-500 h-11">Genre</TableHead>
                  <TableHead
                    className="w-[8%] text-xs font-semibold uppercase tracking-wider text-zinc-500 cursor-pointer hover:text-white transition-colors group h-11"
                    onClick={() => handleSort('bpm')}
                  >
                    <div className="flex items-center">BPM {renderSortIcon('bpm')}</div>
                  </TableHead>
                  <TableHead className="w-[8%] text-xs font-semibold uppercase tracking-wider text-zinc-500 h-11">Key</TableHead>
                  <TableHead
                    className="w-[12%] text-xs font-semibold uppercase tracking-wider text-zinc-500 cursor-pointer hover:text-white transition-colors group h-11"
                    onClick={() => handleSort('addedAt')}
                  >
                    <div className="flex items-center">Date Added {renderSortIcon('addedAt')}</div>
                  </TableHead>
                  <TableHead className="w-[8%] text-xs font-semibold uppercase tracking-wider text-zinc-500 h-11">Status</TableHead>
                  <TableHead className="w-[8%] text-right text-xs font-semibold uppercase tracking-wider text-zinc-500 h-11"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tracks.map((track, index) => (
                  <TableRow
                    key={track.id}
                    className={`border-zinc-900 hover:bg-zinc-900/40 group transition-colors cursor-pointer ${currentTrack?.id === track.id ? 'bg-zinc-900/20' : ''}`}
                    onClick={() => {
                      if (currentTrack?.id === track.id) {
                        setIsPlaying(!isPlaying);
                      } else {
                        setCurrentTrack(track);
                        setIsPlaying(true);
                      }
                    }}
                  >
                    <TableCell className="w-12 text-center text-zinc-600 relative">
                      <span className={`transition-opacity ${currentTrack?.id === track.id ? 'opacity-0' : 'group-hover:opacity-0'}`}>{index + 1}</span>
                      <div className={`absolute inset-0 flex items-center justify-center transition-opacity ${currentTrack?.id === track.id ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                        {currentTrack?.id === track.id && isPlaying ? (
                          <Pause className="w-4 h-4 text-white fill-white" />
                        ) : (
                          <Play className="w-4 h-4 text-white fill-white" />
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-3 min-w-0">
                        <TrackThumbnail src={track.coverUrl} />
                        <span
                          className={`block truncate min-w-0 flex-1 text-sm ${currentTrack?.id === track.id ? 'text-white' : 'text-zinc-200'}`}
                          title={track.title}
                        >
                          {track.title}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-zinc-400 text-sm">
                      <span className="block truncate" title={track.artist}>{track.artist}</span>
                    </TableCell>
                    <TableCell className="text-zinc-400 text-sm">
                      <span className="block truncate" title={track.genres.join(", ")}>
                        {track.genres.length > 0 ? track.genres.join(", ") : "—"}
                      </span>
                    </TableCell>
                    <TableCell className="text-zinc-400 text-sm font-mono">{track.bpm ?? "—"}</TableCell>
                    <TableCell>
                      <span className="text-xs font-mono text-zinc-300">
                        {track.key ?? "—"}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="text-xs text-zinc-400">
                        {formatDateAdded(track.dateAdded)}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">
                        <StatusBadge status={track.status} />
                      </span>
                    </TableCell>
                    <TableCell className="text-right pr-4" onClick={(e) => e.stopPropagation()}>
                      <DropdownMenu>
                        <DropdownMenuTrigger render={
                          <button className="flex items-center justify-center h-8 w-8 text-zinc-500 hover:text-white hover:bg-zinc-800/50 data-[state=open]:bg-zinc-800/50 data-[state=open]:text-white rounded-md transition-colors outline-none cursor-pointer">
                            <MoreHorizontal className="w-4 h-4" />
                          </button>
                        } />
                        <DropdownMenuContent align="end" className="w-48 bg-zinc-950 border-zinc-800 text-zinc-300 rounded-lg p-1 shadow-2xl">
                          <DropdownMenuItem
                            onClick={() => handleDownloadTrack(track)}
                            disabled={downloadingTrackId === track.id}
                            className="focus:!bg-zinc-800 focus:!text-white hover:!bg-zinc-800 hover:!text-white cursor-pointer rounded-md py-2"
                          >
                            {downloadingTrackId === track.id ? (
                              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            ) : (
                              <Download className="w-4 h-4 mr-2" />
                            )}
                            <span className="text-sm">Download</span>
                          </DropdownMenuItem>
                          <DropdownMenuItem className="focus:!bg-zinc-800 focus:!text-white hover:!bg-zinc-800 hover:!text-white cursor-pointer rounded-md py-2">
                            <Settings2 className="w-4 h-4 mr-2" /> <span className="text-sm">Stems Options</span>
                          </DropdownMenuItem>
                          <DropdownMenuSeparator className="bg-zinc-800 my-1" />
                          <AddToPlaylistMenu trackId={track.id} />
                          {canUpload && (
                            <>
                              <DropdownMenuSeparator className="bg-zinc-800 my-1" />
                              <DropdownMenuItem
                                onClick={() => {
                                  setTrackToEdit(track);
                                  setEditDialogOpen(true);
                                }}
                                className="focus:!bg-zinc-800 focus:!text-white hover:!bg-zinc-800 hover:!text-white cursor-pointer rounded-md py-2"
                              >
                                <Pencil className="w-4 h-4 mr-2" /> <span className="text-sm">Edit Info</span>
                              </DropdownMenuItem>
                              <DropdownMenuItem 
                                onClick={() => {
                                  setTrackToDelete(track);
                                  setDeleteDialogOpen(true);
                                }}
                                className="focus:!bg-red-950/50 focus:!text-red-400 hover:!bg-red-950/50 hover:!text-red-400 text-red-500 cursor-pointer rounded-md py-2"
                              >
                                <Trash className="w-4 h-4 mr-2" /> <span className="text-sm">Delete</span>
                              </DropdownMenuItem>
                            </>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
                {tracksLoading && (
                  <TableRow>
                    <TableCell colSpan={9} className="h-32 text-center text-zinc-500">
                      <div className="flex items-center justify-center gap-2">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Loading tracks…
                      </div>
                    </TableCell>
                  </TableRow>
                )}
                {!tracksLoading && tracks.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={9} className="h-32 text-center text-zinc-500">
                      No tracks found in this category.
                    </TableCell>
                  </TableRow>
                )}
                {!tracksLoading && hasMoreTracks && (
                  <TableRow ref={loadMoreRef} className="border-none hover:bg-transparent">
                    <TableCell colSpan={9} className="h-16 text-center text-zinc-500">
                      {tracksLoadingMore && (
                        <div className="flex items-center justify-center gap-2">
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Loading more…
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </div>

      <TrackEditDialog 
        track={trackToEdit} 
        open={editDialogOpen} 
        onOpenChange={setEditDialogOpen} 
      />
      
      <TrackDeleteDialog 
        track={trackToDelete} 
        open={deleteDialogOpen} 
        onOpenChange={setDeleteDialogOpen} 
      />
    </main>
  );
}
