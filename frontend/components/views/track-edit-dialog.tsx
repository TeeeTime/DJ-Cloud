"use client";

import React, { useState, useEffect, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Track } from "@/lib/data";
import { useAuth } from "@/components/providers/auth-provider";
import { tracksApi, artistsApi, ArtistResponse, ApiError } from "@/lib/api";
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
  const [error, setError] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [bpm, setBpm] = useState<string>("");
  const [key, setKey] = useState("");
  const [status, setStatus] = useState<Track["status"]>("QUEUED");
  
  const [artists, setArtists] = useState<ArtistResponse[]>([]);
  const [artistInput, setArtistInput] = useState("");
  const [artistSuggestions, setArtistSuggestions] = useState<ArtistResponse[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  useEffect(() => {
    if (open && track && token) {
      setTitle(track.title);
      setBpm(track.bpm ? track.bpm.toString() : "");
      setKey(track.key || "");
      setStatus(track.status);
      
      // Load current artists' IDs
      const loadArtists = async () => {
        setIsLoadingArtists(true);
        const resolved: ArtistResponse[] = [];
        try {
          for (const name of track.artists) {
            const results = await artistsApi.autocomplete(name);
            const match = results.find(a => a.name.toLowerCase() === name.toLowerCase());
            if (match) resolved.push(match);
          }
          setArtists(resolved);
        } catch (err) {
          console.error("Failed to load artist IDs", err);
        } finally {
          setIsLoadingArtists(false);
        }
      };
      loadArtists();
    } else {
      setArtists([]);
      setArtistInput("");
      setArtistSuggestions([]);
      setError(null);
    }
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

  const handleSave = async () => {
    if (!track || !token) return;
    setIsSaving(true);
    setError(null);
    
    try {
      await tracksApi.update(track.id, {
        title,
        durationSeconds: track.durationSeconds || 0,
        bpm: bpm ? parseInt(bpm, 10) : 0,
        key: key || null,
        status,
        fileFormat: track.format || "mp3",
        artistIds: artists.map(a => a.id)
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
        
        {isLoadingArtists ? (
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
                className="bg-black border-zinc-800 focus-visible:ring-1 focus-visible:ring-zinc-700 h-10"
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-medium text-zinc-400 uppercase tracking-wider mb-1.5 block">BPM</label>
                <Input
                  type="number"
                  value={bpm}
                  onChange={(e) => setBpm(e.target.value)}
                  className="bg-black border-zinc-800 focus-visible:ring-1 focus-visible:ring-zinc-700 h-10"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-zinc-400 uppercase tracking-wider mb-1.5 block">Key</label>
                <Input
                  value={key}
                  onChange={(e) => setKey(e.target.value)}
                  className="bg-black border-zinc-800 focus-visible:ring-1 focus-visible:ring-zinc-700 h-10"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-medium text-zinc-400 uppercase tracking-wider mb-1.5 block">Status</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as Track["status"])}
                className="w-full bg-black border border-zinc-800 rounded-md h-10 px-3 text-sm focus:outline-none focus:ring-1 focus:ring-zinc-700"
              >
                <option value="QUEUED">Queued</option>
                <option value="PROCESSING">Processing</option>
                <option value="READY">Ready</option>
                <option value="FAILED">Failed</option>
              </select>
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
                onFocus={() => setShowSuggestions(true)}
                placeholder="Search to add artist..."
                className="bg-black border-zinc-800 focus-visible:ring-1 focus-visible:ring-zinc-700 h-10"
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
            disabled={isSaving || isLoadingArtists}
            variant="ghost"
            className="text-zinc-400 hover:text-white hover:bg-zinc-900"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={isSaving || isLoadingArtists}
            className="bg-white hover:bg-zinc-200 text-black font-medium"
          >
            {isSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : "Save Changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
