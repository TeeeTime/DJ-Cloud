import { TrackResponse, TrackStatus, tracksApi } from "./api";

export type Track = {
  id: number;
  title: string;
  artist: string;
  artists: string[];
  // Real per-track genre data from the backend, up to 3 — distinct from the unrelated `genre?` field below.
  genres: string[];
  bpm: number | null;
  key: string | null;
  format: string;
  dateAdded: string;
  status: TrackStatus;
  duration: string;
  durationSeconds: number;
  // Not modeled by the backend yet — kept optional so existing filter UI keeps compiling.
  genre?: string;
  playlist?: string;
  audioUrl: string;
  // May 404 — not every track has embedded artwork. Consumers should fall back gracefully.
  coverUrl: string;
};

function formatDuration(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = Math.floor(totalSeconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function formatDateAdded(dateAdded: string): string {
  // dateAdded is already a plain "yyyy-MM-dd" date — just reorder to dd.mm.yyyy.
  const [year, month, day] = dateAdded.split("-");
  return `${day}.${month}.${year}`;
}

export function mapTrackResponse(t: TrackResponse): Track {
  return {
    id: t.id,
    title: t.title,
    artist: t.artists.length > 0 ? t.artists.join(", ") : "Unknown Artist",
    artists: t.artists,
    genres: t.genres,
    bpm: t.bpm > 0 ? t.bpm : null,
    key: t.key,
    format: t.fileFormat.toUpperCase(),
    dateAdded: t.dateAdded,
    status: t.status,
    duration: formatDuration(t.durationSeconds),
    durationSeconds: t.durationSeconds,
    audioUrl: tracksApi.audioUrl(t.id),
    coverUrl: tracksApi.coverUrl(t.id),
  };
}

export const playlists = ["Peak Time", "Warmup", "Classics"];
export const genres = ["Tech House", "Deep House", "Progressive", "Dubstep"];

export const colorThemes = [
  { name: 'Default', filter: 'none' },
  { name: 'Cyberpunk', filter: 'sepia(1) hue-rotate(250deg) saturate(300%) contrast(120%)' },
  { name: 'Matrix', filter: 'sepia(1) hue-rotate(70deg) saturate(300%) contrast(120%)' },
  { name: 'Ocean', filter: 'sepia(1) hue-rotate(180deg) saturate(200%) contrast(110%)' },
  { name: 'Blood', filter: 'sepia(1) hue-rotate(320deg) saturate(400%) contrast(150%)' }
];
