"use client";

import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Track } from "@/lib/data";
import { useAuth } from "@/components/providers/auth-provider";
import { tracksApi, artistsApi, ArtistResponse, genresApi, GenreResponse, ApiError } from "@/lib/api";
import { Loader2, AlertCircle, X } from "lucide-react";
import { usePlayer } from "@/components/providers/player-provider";

interface TrackEditDialogProps {
  track: Track | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function TrackEditDialog({ track, open, onOpenChange }: TrackEditDialogProps) {
  const { token } = useAuth();
  const { refreshTracks } = usePlayer();
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
    setError(null);
  } else if (!open && initializedFor.open) {
    setInitializedFor({ open: false, trackId: null });
    setArtists([]);
    setArtistInput("");
    setArtistSuggestions([]);
    setGenres([]);
    setGenreInput("");
    setGenreSuggestions([]);
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
      
      await refreshTracks();
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Save failed. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(val) => { if (!isSaving) onOpenChange(val); }}>
      <DialogContent className="bg-zinc-950 border-zinc-900 text-white sm:max-w-md rounded-xl p-6">
        <DialogHeader className="mb-6">
          <DialogTitle className="text-xl font-semibold">Edit Track Info</DialogTitle>
        </DialogHeader>
        
        {isLoadingArtists || isLoadingGenres ? (
          <div className="py-12 flex justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-zinc-500" />
          </div>
        ) : (
          <div className="py-2 space-y-4">
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
                onKeyDown={(e) => {
                  if (e.key === "Enter" && artistInput.trim() !== "") {
                    e.preventDefault();
                    addArtist({ id: -Math.floor(Math.random() * 1000000), name: artistInput.trim() });
                  }
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
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && genreInput.trim() !== "") {
                        e.preventDefault();
                        addGenre({ id: -Math.floor(Math.random() * 1000000), name: genreInput.trim() });
                      }
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
