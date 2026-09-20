"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { Play, Pause, Ban, Download, Pencil, Trash, MoreHorizontal, Loader2, AlertCircle, Menu as MenuIcon, Search, ArrowUpDown, ChevronUp, ChevronDown, Cloud, CloudCheck } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/components/providers/auth-provider";
import { usePlayer } from "@/components/providers/player-provider";
import { useGenres } from "@/components/providers/genre-provider";
import { Track, formatDateAdded, isPlayableStatus } from "@/lib/data";
import { ApiError, genresApi, tracksApi } from "@/lib/api";
import { downloadFile } from "@/lib/download";
import { usePagedTracks, FetchTracksPageParams } from "@/lib/use-paged-tracks";
import { useDebouncedValue } from "@/lib/use-debounced-value";
import { Sidebar } from "@/components/layout/sidebar";
import { StatusBadge, TrackThumbnail } from "./track-row-parts";
import { AddToPlaylistMenu } from "./add-to-playlist-menu";
import { TrackEditDialog } from "./track-edit-dialog";
import { TrackDeleteDialog } from "./track-delete-dialog";

type SortConfig = { key: keyof Track, direction: 'asc' | 'desc' } | null;

const DEFAULT_SORT_KEY = 'title';

interface GenreViewProps {
  genreName: string;
}

export function GenreView({ genreName }: GenreViewProps) {
  const { user, token } = useAuth();
  const { currentTrack, setCurrentTrack, isPlaying, setIsPlaying, setActiveTrackOrder } = usePlayer();
  const { genreSyncs, refreshGenreSyncs } = useGenres();
  const canUpload = user?.role === 'EDITOR' || user?.role === 'ADMIN';
  const isSyncEnabled = genreSyncs.find(g => g.name === genreName)?.syncEnabled ?? false;

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const [searchQuery, setSearchQuery] = useState("");
  const [sortConfig, setSortConfig] = useState<SortConfig>(null);
  const debouncedSearchQuery = useDebouncedValue(searchQuery);

  const fetchGenreTracksPage = useCallback((params: FetchTracksPageParams) => {
    return genresApi.getTracks(genreName, params);
  }, [genreName]);

  const {
    tracks,
    isLoading: tracksLoading,
    isLoadingMore: tracksLoadingMore,
    error: tracksError,
    hasMore: hasMoreTracks,
    loadMore: loadMoreTracks,
    reset: resetTracks,
  } = usePagedTracks({
    query: debouncedSearchQuery,
    sortConfig,
    defaultSortKey: DEFAULT_SORT_KEY,
    fetchPage: fetchGenreTracksPage,
  });

  // Skip-forward/back in the bottom player should follow this genre's own visible order while
  // it's the active view, reverting to the library default when the user navigates away.
  useEffect(() => {
    setActiveTrackOrder(tracks);
  }, [tracks, setActiveTrackOrder]);

  useEffect(() => () => setActiveTrackOrder(null), [setActiveTrackOrder]);

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

  const handleSort = (key: keyof Track) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const renderSortIcon = (key: keyof Track) => {
    if (sortConfig?.key !== key) return <ArrowUpDown className="w-3 h-3 ml-1 opacity-20 group-hover:opacity-100 transition-opacity" />;
    if (sortConfig.direction === 'asc') return <ChevronUp className="w-3 h-3 ml-1 text-white" />;
    return <ChevronDown className="w-3 h-3 ml-1 text-white" />;
  };

  const [trackToEdit, setTrackToEdit] = useState<Track | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);

  const [trackToDelete, setTrackToDelete] = useState<Track | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  const [downloadingTrackId, setDownloadingTrackId] = useState<number | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  const [isDownloadingGenre, setIsDownloadingGenre] = useState(false);
  const [genreDownloadError, setGenreDownloadError] = useState<string | null>(null);

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

  const handleDownloadGenre = async () => {
    if (!token) return;
    setIsDownloadingGenre(true);
    setGenreDownloadError(null);
    try {
      await downloadFile(genresApi.downloadUrl(genreName), token, `${genreName}.zip`);
    } catch (err) {
      setGenreDownloadError(err instanceof ApiError ? err.message : "Download failed. Please try again.");
    } finally {
      setIsDownloadingGenre(false);
    }
  };

  const toggleSync = async () => {
    if (!token) return;
    try {
      if (isSyncEnabled) {
        await genresApi.disableSync(genreName, token);
      } else {
        await genresApi.enableSync(genreName, token);
      }
      refreshGenreSyncs();
    } catch (err) {
      console.error(err instanceof ApiError ? err.message : err);
    }
  };

  return (
    <main className="flex-1 flex flex-col min-w-0 bg-zinc-950/30 ambient-surface-main relative h-full">
      <header className="h-20 flex items-center justify-between px-4 md:px-8 border-b border-zinc-900 bg-black/50 backdrop-blur-xl ambient-surface-header sticky top-0 z-10 shrink-0 gap-4">
        <div className="flex items-center gap-4 flex-1">
          <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
            <SheetTrigger render={<Button variant="ghost" size="icon" className="md:hidden text-zinc-400 hover:text-white shrink-0" />}>
              <MenuIcon className="w-5 h-5" />
            </SheetTrigger>
            <SheetContent side="left" className="p-0 bg-black border-r border-zinc-900 w-64 sm:max-w-64">
              <SheetTitle className="sr-only">Navigation Menu</SheetTitle>
              <Sidebar isMobile={true} />
            </SheetContent>
          </Sheet>

          <div className="relative w-full max-w-xs group">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 group-focus-within:text-white transition-colors" />
            <Input
              placeholder="Search this genre..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 bg-black border-zinc-800 text-white focus-visible:ring-1 focus-visible:ring-zinc-700 focus-visible:border-zinc-700 transition-all rounded-md h-10 placeholder:text-zinc-600"
            />
          </div>
        </div>
      </header>

      <div ref={scrollContainerRef} className="flex-1 overflow-y-auto pb-6">
        <div className="px-8 py-8">
          <div className="flex items-center gap-3 mb-8">
            <h2 className="text-3xl font-bold text-white tracking-tight">
              {genreName}
            </h2>
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleSync}
              title={isSyncEnabled ? "Syncing to Desktop" : "Sync to Desktop"}
              className="text-zinc-500 hover:text-white hover:bg-zinc-800/50"
            >
              {isSyncEnabled ? <CloudCheck className="w-4 h-4" /> : <Cloud className="w-4 h-4" />}
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger render={
                <button className="ml-auto flex items-center justify-center h-8 w-8 text-zinc-500 hover:text-white hover:bg-zinc-800/50 data-[state=open]:bg-zinc-800/50 data-[state=open]:text-white rounded-md transition-colors outline-none cursor-pointer">
                  <MoreHorizontal className="w-4 h-4" />
                </button>
              } />
              <DropdownMenuContent align="end" className="w-52 bg-zinc-950 border-zinc-800 text-zinc-300 rounded-lg p-1 shadow-2xl">
                <DropdownMenuItem
                  onClick={handleDownloadGenre}
                  disabled={isDownloadingGenre}
                  className="focus:!bg-zinc-800 focus:!text-white hover:!bg-zinc-800 hover:!text-white cursor-pointer rounded-md py-2"
                >
                  {isDownloadingGenre ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Download className="w-4 h-4 mr-2" />
                  )}
                  <span className="text-sm">Download</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {tracksError && (
            <div className="mb-6 flex items-center gap-2 text-sm text-red-400 border border-red-950 bg-red-950/20 rounded-lg px-4 py-3">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {tracksError}
            </div>
          )}

          {genreDownloadError && (
            <div className="mb-6 flex items-center gap-2 text-sm text-red-400 border border-red-950 bg-red-950/20 rounded-lg px-4 py-3">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {genreDownloadError}
            </div>
          )}

          {downloadError && (
            <div className="mb-6 flex items-center gap-2 text-sm text-red-400 border border-red-950 bg-red-950/20 rounded-lg px-4 py-3">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {downloadError}
            </div>
          )}

          <div className="rounded-xl border border-zinc-900 bg-black/50 ambient-surface-card overflow-hidden w-full">
            <Table className="table-fixed w-full">
              <TableHeader className="bg-zinc-900/30 select-none">
                <TableRow className="border-zinc-900 hover:bg-transparent">
                  <TableHead className="w-[4%] text-center h-11">#</TableHead>
                  <TableHead
                    className="w-[21%] text-xs font-semibold uppercase tracking-wider text-zinc-500 cursor-pointer hover:text-white transition-colors group h-11"
                    onClick={() => handleSort('title')}
                  >
                    <div className="flex items-center">Title {renderSortIcon('title')}</div>
                  </TableHead>
                  <TableHead
                    className="w-[15%] text-xs font-semibold uppercase tracking-wider text-zinc-500 cursor-pointer hover:text-white transition-colors group h-11"
                    onClick={() => handleSort('artist')}
                  >
                    <div className="flex items-center">Artist {renderSortIcon('artist')}</div>
                  </TableHead>
                  <TableHead className="w-[13%] text-xs font-semibold uppercase tracking-wider text-zinc-500 h-11">Genre</TableHead>
                  <TableHead
                    className="w-[7%] text-xs font-semibold uppercase tracking-wider text-zinc-500 cursor-pointer hover:text-white transition-colors group h-11"
                    onClick={() => handleSort('bpm')}
                  >
                    <div className="flex items-center">BPM {renderSortIcon('bpm')}</div>
                  </TableHead>
                  <TableHead className="w-[7%] text-xs font-semibold uppercase tracking-wider text-zinc-500 h-11">Key</TableHead>
                  <TableHead
                    className="w-[11%] text-xs font-semibold uppercase tracking-wider text-zinc-500 cursor-pointer hover:text-white transition-colors group h-11"
                    onClick={() => handleSort('addedAt')}
                  >
                    <div className="flex items-center">Date Added {renderSortIcon('addedAt')}</div>
                  </TableHead>
                  <TableHead
                    className="w-[8%] text-xs font-semibold uppercase tracking-wider text-zinc-500 cursor-pointer hover:text-white transition-colors group h-11"
                    onClick={() => handleSort('durationSeconds')}
                  >
                    <div className="flex items-center">Length {renderSortIcon('durationSeconds')}</div>
                  </TableHead>
                  <TableHead className="w-[7%] text-xs font-semibold uppercase tracking-wider text-zinc-500 h-11">Status</TableHead>
                  <TableHead className="w-[7%] text-right text-xs font-semibold uppercase tracking-wider text-zinc-500 h-11"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tracks.map((track, index) => (
                  <TableRow
                    key={track.id}
                    className={`border-zinc-900 hover:bg-zinc-900/40 group transition-colors ${isPlayableStatus(track.status) ? 'cursor-pointer' : 'cursor-not-allowed'} ${currentTrack?.id === track.id ? 'bg-zinc-900/20' : ''}`}
                    onClick={() => {
                      if (!isPlayableStatus(track.status)) return;
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
                        {!isPlayableStatus(track.status) ? (
                          <Ban className="w-4 h-4 text-zinc-600" />
                        ) : currentTrack?.id === track.id && isPlaying ? (
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
                      <span className="text-xs font-mono text-zinc-400">
                        {track.duration}
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
                    <TableCell colSpan={10} className="h-32 text-center text-zinc-500">
                      <div className="flex items-center justify-center gap-2">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Loading tracks…
                      </div>
                    </TableCell>
                  </TableRow>
                )}
                {!tracksLoading && tracks.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={10} className="h-32 text-center text-zinc-500">
                      No tracks found in this genre.
                    </TableCell>
                  </TableRow>
                )}
                {!tracksLoading && hasMoreTracks && (
                  <TableRow ref={loadMoreRef} className="border-none hover:bg-transparent">
                    <TableCell colSpan={10} className="h-16 text-center text-zinc-500">
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
        onOpenChange={(open) => { setEditDialogOpen(open); if (!open) resetTracks(); }}
      />

      <TrackDeleteDialog
        track={trackToDelete}
        open={deleteDialogOpen}
        onOpenChange={(open) => { setDeleteDialogOpen(open); if (!open) resetTracks(); }}
      />
    </main>
  );
}
