"use client";

import React, { useState, useEffect, useLayoutEffect, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Track, bumpCoverVersion } from "@/lib/data";
import { useAuth } from "@/components/providers/auth-provider";
import { tracksApi, artistsApi, ArtistResponse, genresApi, GenreResponse, ApiError } from "@/lib/api";
import { Loader2, AlertCircle, X, CloudUpload, Pencil } from "lucide-react";
import { usePlayer } from "@/components/providers/player-provider";
import { useGenres } from "@/components/providers/genre-provider";

interface TrackEditDialogProps {
  track: Track | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function TrackEditDialog({ track, open, onOpenChange }: TrackEditDialogProps) {
  const { token } = useAuth();
  const { refreshTracks } = usePlayer();
  const { refreshGenres } = useGenres();
  const [isSaving, setIsSaving] = useState(false);
  const [isLoadingArtists, setIsLoadingArtists] = useState(false);
  const [isLoadingGenres, setIsLoadingGenres] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [bpm, setBpm] = useState<string>("");
  const [key, setKey] = useState("");
  const [status, setStatus] = useState<Track["status"]>("QUEUED");
  
  const [artists, setArtists] = useState<ArtistResponse[]>([]);
  const [artistInput, setArtistInput] = useState("");
  const [artistSuggestions, setArtistSuggestions] = useState<ArtistResponse[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  const [genres, setGenres] = useState<GenreResponse[]>([]);
  const [genreInput, setGenreInput] = useState("");
  const [genreSuggestions, setGenreSuggestions] = useState<GenreResponse[]>([]);
  const [showGenreSuggestions, setShowGenreSuggestions] = useState(false);

  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreviewUrl, setCoverPreviewUrl] = useState<string | null>(null);
  const [removeCoverStaged, setRemoveCoverStaged] = useState(false);
  const [coverDragActive, setCoverDragActive] = useState(false);
  const [coverLoadError, setCoverLoadError] = useState(false);
  const coverInputRef = useRef<HTMLInputElement>(null);

  // The cover square's size can't be derived from its sibling's height with CSS alone — the
  // square's own content is entirely absolutely-positioned, so it has no intrinsic size, and
  // `aspect-ratio` deriving a grid/flex item's width from a stretched height is inconsistently
  // supported across browsers (works in Chrome, not in Firefox). Measuring directly sidesteps that.
  const [coverSize, setCoverSize] = useState(96);
  // A callback ref (not useRef+empty-deps effect) so this re-attaches whenever the element
  // actually appears — the plain-useRef version missed it, since this dialog stays mounted
  // across opens and the right column is hidden behind the isLoadingArtists/isLoadingGenres
  // spinner branch the very first time this component mounts.
  const [rightColumnEl, setRightColumnEl] = useState<HTMLDivElement | null>(null);

  useLayoutEffect(() => {
    if (!rightColumnEl) return;
    const update = () => setCoverSize(rightColumnEl.offsetHeight);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(rightColumnEl);
    return () => observer.disconnect();
  }, [rightColumnEl]);

  // Resets the form fields when the dialog opens for a (possibly different) track. Done during
  // render rather than in an effect, per https://react.dev/learn/you-might-not-need-an-effect —
  // this is "adjusting state when a prop changes", not synchronizing with an external system.
  // Uses state (not a ref) to track what we last initialized for, since refs can't be read or
  // written during render.
  const [initializedFor, setInitializedFor] = useState<{ open: boolean; trackId: number | null }>({
    open: false,
    trackId: null,
  });

  if (open && track && token && (!initializedFor.open || initializedFor.trackId !== track.id)) {
    setInitializedFor({ open: true, trackId: track.id });
    setTitle(track.title);
    setBpm(track.bpm ? track.bpm.toString() : "");
    setKey(track.key || "");
    setStatus(track.status);
    // Pre-populate artists immediately with fake IDs so they show up in the UI
    setArtists((track.artists || []).map((name, idx) => ({ id: -(idx + 1), name })));
    setArtistInput("");
    setArtistSuggestions([]);
    // Pre-populate genres immediately with fake IDs so they show up in the UI
    setGenres((track.genres || []).map((name, idx) => ({ id: -(idx + 1), name })));
    setGenreInput("");
    setGenreSuggestions([]);
    if (coverPreviewUrl) URL.revokeObjectURL(coverPreviewUrl);
    setCoverFile(null);
    setCoverPreviewUrl(null);
    setRemoveCoverStaged(false);
    setCoverDragActive(false);
    setCoverLoadError(false);
    setError(null);
  } else if (!open && initializedFor.open) {
    setInitializedFor({ open: false, trackId: null });
    setArtists([]);
    setArtistInput("");
    setArtistSuggestions([]);
    setGenres([]);
    setGenreInput("");
    setGenreSuggestions([]);
    if (coverPreviewUrl) URL.revokeObjectURL(coverPreviewUrl);
    setCoverFile(null);
    setCoverPreviewUrl(null);
    setRemoveCoverStaged(false);
    setCoverDragActive(false);
    setCoverLoadError(false);
    setError(null);
  }

  // Loads current artists' actual IDs in the background if they exist — a real side effect
  // (fetching from the API), so it stays in an effect unlike the resets above.
  useEffect(() => {
    if (!open || !track || !token) {
      return;
    }

    let cancelled = false;
    const loadArtists = async () => {
      setIsLoadingArtists(true);
      const resolved: ArtistResponse[] = [];
      try {
        for (let idx = 0; idx < (track.artists || []).length; idx++) {
          const name = track.artists[idx];
          const results = await artistsApi.autocomplete(name);
          const match = results.find(a => a.name.toLowerCase() === name.toLowerCase());
          if (match) resolved.push(match);
          else resolved.push({ id: -(idx + 1), name }); // keep fake ID
        }
        if (!cancelled) setArtists(resolved);
      } catch (err) {
        console.error("Failed to load artist IDs", err);
      } finally {
        if (!cancelled) setIsLoadingArtists(false);
      }
    };
    loadArtists();

    return () => {
      cancelled = true;
    };
  }, [open, track, token]);

  // Loads current genres' actual IDs in the background if they exist — mirrors loadArtists above.
  useEffect(() => {
    if (!open || !track || !token) {
      return;
    }

    let cancelled = false;
    const loadGenres = async () => {
      setIsLoadingGenres(true);
      const resolved: GenreResponse[] = [];
      try {
        for (let idx = 0; idx < (track.genres || []).length; idx++) {
          const name = track.genres[idx];
          const results = await genresApi.autocomplete(name);
          const match = results.find(g => g.name.toLowerCase() === name.toLowerCase());
          if (match) resolved.push(match);
          else resolved.push({ id: -(idx + 1), name }); // keep fake ID
        }
        if (!cancelled) setGenres(resolved);
      } catch (err) {
        console.error("Failed to load genre IDs", err);
      } finally {
        if (!cancelled) setIsLoadingGenres(false);
      }
    };
    loadGenres();

    return () => {
      cancelled = true;
    };
  }, [open, track, token]);

  // Enter should reuse an existing artist/genre by name (case-insensitively) instead of always
  // minting a "pending create" chip — otherwise Save hits the backend's duplicate-name 409 for
  // anything that already exists. Checks already-added items and the current suggestions first;
  // falls back to a fresh lookup in case Enter beat the debounced search to it.
  const resolveTagByName = async <T extends { id: number; name: string }>(
    trimmed: string,
    added: T[],
    suggestions: T[],
    autocomplete: (query: string) => Promise<T[]>,
  ): Promise<T> => {
    const isMatch = (item: T) => item.name.toLowerCase() === trimmed.toLowerCase();
    const existing = added.find(isMatch) ?? suggestions.find(isMatch);
    if (existing) return existing;

    try {
      const results = await autocomplete(trimmed);
      const match = results.find(isMatch);
      if (match) return match;
    } catch (err) {
      console.error(err);
    }

    return { id: -Math.floor(Math.random() * 1000000), name: trimmed } as T;
  };

  const searchArtists = async (query: string) => {
    if (!query) {
      setArtistSuggestions([]);
      return;
    }
    try {
      const results = await artistsApi.autocomplete(query);
      setArtistSuggestions(results);
    } catch (err) {
      console.error(err);
    }
  };

  const addArtist = (artist: ArtistResponse) => {
    if (!artists.find(a => a.id === artist.id)) {
      setArtists([...artists, artist]);
    }
    setArtistInput("");
    setArtistSuggestions([]);
    setShowSuggestions(false);
  };

  const removeArtist = (id: number) => {
    setArtists(artists.filter(a => a.id !== id));
  };

  const searchGenres = async (query: string) => {
    if (!query) {
      setGenreSuggestions([]);
      return;
    }
    try {
      const results = await genresApi.autocomplete(query);
      setGenreSuggestions(results);
    } catch (err) {
      console.error(err);
    }
  };

  const addGenre = (genre: GenreResponse) => {
    if (genres.length >= 3) return;
    if (!genres.find(g => g.id === genre.id)) {
      setGenres([...genres, genre]);
    }
    setGenreInput("");
    setGenreSuggestions([]);
    setShowGenreSuggestions(false);
  };

  const removeGenre = (id: number) => {
    setGenres(genres.filter(g => g.id !== id));
  };

  const ACCEPTED_COVER_EXTENSIONS = [".jpg", ".jpeg", ".png"];
  const MAX_COVER_SIZE = 10 * 1024 * 1024;

  const validateAndSetCoverFile = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const file = files[0];
    const lowerName = file.name.toLowerCase();
    if (!ACCEPTED_COVER_EXTENSIONS.some(ext => lowerName.endsWith(ext))) {
      setError("Cover image must be a .jpg, .jpeg, or .png file.");
      return;
    }
    if (file.size > MAX_COVER_SIZE) {
      setError("Cover image is too large (max 10MB).");
      return;
    }
    if (coverPreviewUrl) URL.revokeObjectURL(coverPreviewUrl);
    setCoverFile(file);
    setCoverPreviewUrl(URL.createObjectURL(file));
    setRemoveCoverStaged(false);
    setCoverLoadError(false);
    setError(null);
  };

  // If a new file was just staged, un-stage it (revert to whatever was showing before). Otherwise
  // there's a real existing cover and nothing staged — stage its removal for Save.
  const clearStagedCover = () => {
    if (coverFile) {
      if (coverPreviewUrl) URL.revokeObjectURL(coverPreviewUrl);
      setCoverFile(null);
      setCoverPreviewUrl(null);
    } else {
      setRemoveCoverStaged(true);
    }
  };

  const handleSave = async () => {
    if (!track || !token) return;
    setIsSaving(true);
    setError(null);
    
    try {
      // Create missing artists
      const finalArtistIds: number[] = [];
      for (const artist of artists) {
        if (artist.id < 0) {
          // Negative ID means it hasn't been created in DB yet
          const created = await artistsApi.create(artist.name, token);
          finalArtistIds.push(created.id);
        } else {
          finalArtistIds.push(artist.id);
        }
      }

      // Create missing genres
      const finalGenreIds: number[] = [];
      for (const genre of genres) {
        if (genre.id < 0) {
          const created = await genresApi.create(genre.name, token);
          finalGenreIds.push(created.id);
        } else {
          finalGenreIds.push(genre.id);
        }
      }

      await tracksApi.update(track.id, {
        title,
        durationSeconds: track.durationSeconds || 0,
        bpm: bpm ? parseInt(bpm, 10) : 0,
        key: key || null,
        status,
        fileFormat: track.format || "mp3",
        artistIds: finalArtistIds,
        genreIds: finalGenreIds
      }, token);

      if (coverFile) {
        await tracksApi.updateCover(track.id, coverFile, token);
        bumpCoverVersion(track.id);
      } else if (removeCoverStaged) {
        await tracksApi.removeCover(track.id, token);
        bumpCoverVersion(track.id);
      }

      await refreshTracks();
      await refreshGenres();
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Save failed. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(val) => { if (!isSaving) onOpenChange(val); }}>
      <DialogContent className="bg-zinc-950 border-zinc-900 text-white sm:max-w-lg rounded-xl p-6">
        <DialogHeader className="mb-6">
          <DialogTitle className="text-xl font-semibold">Edit Track Info</DialogTitle>
        </DialogHeader>
        
        {isLoadingArtists || isLoadingGenres ? (
          <div className="py-12 flex justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-zinc-500" />
          </div>
        ) : (
          <div className="py-2 space-y-4">
            <div className="flex gap-4">
              {(() => {
                const showingImage = !!coverPreviewUrl || (!!track?.coverUrl && !coverLoadError && !removeCoverStaged);
                const imageSrc = coverPreviewUrl ?? (!removeCoverStaged ? track?.coverUrl : undefined);
                return (
                  <div
                    onClick={() => coverInputRef.current?.click()}
                    onDragOver={(e) => { e.preventDefault(); setCoverDragActive(true); }}
                    onDragLeave={() => setCoverDragActive(false)}
                    onDrop={(e) => {
                      e.preventDefault();
                      setCoverDragActive(false);
                      validateAndSetCoverFile(e.dataTransfer.files);
                    }}
                    style={{ width: coverSize, height: coverSize }}
                    className="relative shrink-0 cursor-pointer group"
                  >
                    <input
                      ref={coverInputRef}
                      type="file"
                      accept=".jpg,.jpeg,.png"
                      className="hidden"
                      onChange={(e) => {
                        validateAndSetCoverFile(e.target.files);
                        e.target.value = "";
                      }}
                    />
                    <div
                      className={`absolute inset-0 rounded-lg border border-dashed overflow-hidden transition-all ${coverDragActive ? 'border-zinc-400 bg-zinc-900/80' : 'border-zinc-700 bg-zinc-900/50 hover:border-zinc-500'}`}
                    >
                      {showingImage && imageSrc ? (
                        <>
                          <img
                            src={imageSrc}
                            alt=""
                            onError={() => setCoverLoadError(true)}
                            className="absolute inset-0 w-full h-full object-cover"
                          />
                          <div className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/50 transition-colors">
                            <Pencil className="w-4 h-4 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                          </div>
                        </>
                      ) : (
                        <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 text-center px-1">
                          <CloudUpload className="w-5 h-5 text-zinc-500 group-hover:text-zinc-300 transition-colors" />
                          <span className="text-[10px] text-zinc-600 leading-tight">Drag &amp; drop or click</span>
                        </div>
                      )}
                    </div>
                    {showingImage && imageSrc && (
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); clearStagedCover(); }}
                        className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center text-zinc-400 hover:text-white hover:bg-zinc-700 z-10"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                );
              })()}

              <div ref={setRightColumnEl} className="flex-1 space-y-4 min-w-0">
                <div>
                  <label className="text-xs font-medium text-zinc-400 uppercase tracking-wider mb-1.5 block">Title</label>
                  <Input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="bg-zinc-900/50 border-zinc-800 focus-visible:ring-1 focus-visible:ring-zinc-700 h-10"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-medium text-zinc-400 uppercase tracking-wider mb-1.5 block">BPM</label>
                    <Input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      value={bpm}
                      onChange={(e) => setBpm(e.target.value)}
                      className="bg-zinc-900/50 border-zinc-800 focus-visible:ring-1 focus-visible:ring-zinc-700 h-10"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-zinc-400 uppercase tracking-wider mb-1.5 block">Key</label>
                    <Input
                      value={key}
                      onChange={(e) => setKey(e.target.value)}
                      className="bg-zinc-900/50 border-zinc-800 focus-visible:ring-1 focus-visible:ring-zinc-700 h-10"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="relative">
              <label className="text-xs font-medium text-zinc-400 uppercase tracking-wider mb-1.5 block">Artists</label>
              <div className="flex flex-wrap gap-2 mb-2">
                {artists.map(artist => (
                  <span key={artist.id} className="inline-flex items-center gap-1 bg-zinc-900 border border-zinc-800 text-xs px-2 py-1 rounded-md">
                    {artist.name}
                    <button onClick={() => removeArtist(artist.id)} className="text-zinc-500 hover:text-white">
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
              <Input
                value={artistInput}
                onChange={(e) => {
                  setArtistInput(e.target.value);
                  searchArtists(e.target.value);
                  setShowSuggestions(true);
                }}
                onKeyDown={async (e) => {
                  const trimmed = artistInput.trim();
                  if (e.key !== "Enter" || trimmed === "") return;
                  e.preventDefault();
                  addArtist(await resolveTagByName(trimmed, artists, artistSuggestions, artistsApi.autocomplete));
                }}
                onFocus={() => setShowSuggestions(true)}
                placeholder="Search to add artist (press Enter to create)..."
                className="bg-zinc-900/50 border-zinc-800 focus-visible:ring-1 focus-visible:ring-zinc-700 h-10"
              />
              
              {showSuggestions && artistSuggestions.length > 0 && (
                <div className="absolute z-10 w-full mt-1 bg-zinc-900 border border-zinc-800 rounded-md shadow-lg max-h-40 overflow-y-auto">
                  {artistSuggestions.map(artist => (
                    <button
                      key={artist.id}
                      onClick={() => addArtist(artist)}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-zinc-800"
                    >
                      {artist.name}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="relative">
              <label className="text-xs font-medium text-zinc-400 uppercase tracking-wider mb-1.5 block">Genres</label>
              <div className="flex flex-wrap gap-2 mb-2">
                {genres.map(genre => (
                  <span key={genre.id} className="inline-flex items-center gap-1 bg-zinc-900 border border-zinc-800 text-xs px-2 py-1 rounded-md">
                    {genre.name}
                    <button onClick={() => removeGenre(genre.id)} className="text-zinc-500 hover:text-white">
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
              {genres.length >= 3 ? (
                <p className="text-xs text-zinc-500 mt-1">Maximum of 3 genres</p>
              ) : (
                <>
                  <Input
                    value={genreInput}
                    onChange={(e) => {
                      setGenreInput(e.target.value);
                      searchGenres(e.target.value);
                      setShowGenreSuggestions(true);
                    }}
                    onKeyDown={async (e) => {
                      const trimmed = genreInput.trim();
                      if (e.key !== "Enter" || trimmed === "") return;
                      e.preventDefault();
                      addGenre(await resolveTagByName(trimmed, genres, genreSuggestions, genresApi.autocomplete));
                    }}
                    onFocus={() => setShowGenreSuggestions(true)}
                    placeholder="Search to add genre (press Enter to create)..."
                    className="bg-zinc-900/50 border-zinc-800 focus-visible:ring-1 focus-visible:ring-zinc-700 h-10"
                  />

                  {showGenreSuggestions && genreSuggestions.length > 0 && (
                    <div className="absolute z-10 w-full mt-1 bg-zinc-900 border border-zinc-800 rounded-md shadow-lg max-h-40 overflow-y-auto">
                      {genreSuggestions.map(genre => (
                        <button
                          key={genre.id}
                          onClick={() => addGenre(genre)}
                          className="w-full text-left px-3 py-2 text-sm hover:bg-zinc-800"
                        >
                          {genre.name}
                        </button>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>

            {error && (
              <p className="text-sm text-red-400 mt-4 flex items-center gap-2" role="alert">
                <AlertCircle className="w-4 h-4 shrink-0" />
                {error}
              </p>
            )}
          </div>
        )}
        
        <DialogFooter className="mt-8 gap-2">
          <Button
            onClick={() => onOpenChange(false)}
            disabled={isSaving || isLoadingArtists || isLoadingGenres}
            variant="ghost"
            className="text-zinc-400 hover:text-white hover:bg-zinc-900"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={isSaving || isLoadingArtists || isLoadingGenres}
            className="bg-white hover:bg-zinc-200 text-black font-medium"
          >
            {isSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : "Save Changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
