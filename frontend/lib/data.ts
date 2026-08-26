import { TrackResponse, TrackStatus, tracksApi } from "./api";

export type Track = {
  id: number;
  title: string;
  artist: string;
  bpm: number | null;
  key: string | null;
  format: string;
  status: TrackStatus;
  duration: string;
  durationSeconds: number;
  // Not modeled by the backend yet — kept optional so existing filter UI keeps compiling.
  genre?: string;
  playlist?: string;
  audioUrl: string;
};

function formatDuration(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = Math.floor(totalSeconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function mapTrackResponse(t: TrackResponse): Track {
  return {
    id: t.id,
    title: t.title,
    artist: t.artists.length > 0 ? t.artists.join(", ") : "Unknown Artist",
    bpm: t.bpm > 0 ? t.bpm : null,
    key: t.key,
    format: t.fileFormat.toUpperCase(),
    status: t.status,
    duration: formatDuration(t.durationSeconds),
    durationSeconds: t.durationSeconds,
    audioUrl: tracksApi.audioUrl(t.id),
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
