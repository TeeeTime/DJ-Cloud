export type Track = {
  id: number;
  title: string;
  artist: string;
  bpm: number;
  key: string;
  uploadedBy: string;
  format: string;
  stems: string;
  duration: string;
  genre: string;
  playlist?: string;
  audioUrl?: string; // URL for actual audio playback
};

export const mockTracks: Track[] = [
  { id: 1, title: "Losing It", artist: "FISHER", bpm: 125, key: "Am", uploadedBy: "Tom", format: "MP3", stems: "Ready", duration: "4:08", genre: "Tech House", playlist: "Peak Time", audioUrl: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3' },
  { id: 2, title: "Innerbloom", artist: "RÜFÜS DU SOL", bpm: 122, key: "Em", uploadedBy: "Carlos", format: "WAV", stems: "Processing", duration: "9:38", genre: "Deep House", playlist: "Warmup", audioUrl: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3' },
  { id: 3, title: "Bangarang", artist: "Skrillex", bpm: 110, key: "Gm", uploadedBy: "Julius", format: "MP3", stems: "Ready", duration: "3:35", genre: "Dubstep", playlist: "Peak Time", audioUrl: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3' },
  { id: 4, title: "Levels", artist: "Avicii", bpm: 126, key: "C#m", uploadedBy: "Carlos", format: "WAV", stems: "Ready", duration: "5:38", genre: "Progressive", playlist: "Classics", audioUrl: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-4.mp3' },
  { id: 5, title: "Opus", artist: "Eric Prydz", bpm: 126, key: "Fm", uploadedBy: "Tom", format: "MP3", stems: "Failed", duration: "9:03", genre: "Progressive", playlist: "Peak Time", audioUrl: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-5.mp3' },
  { id: 6, title: "Strobe", artist: "deadmau5", bpm: 128, key: "F#m", uploadedBy: "Julius", format: "WAV", stems: "Ready", duration: "10:37", genre: "Progressive", playlist: "Classics", audioUrl: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3' },
];

export const playlists = ["Peak Time", "Warmup", "Classics"];
export const genres = ["Tech House", "Deep House", "Progressive", "Dubstep"];

export const colorThemes = [
  { name: 'Default', filter: 'none' },
  { name: 'Cyberpunk', filter: 'sepia(1) hue-rotate(250deg) saturate(300%) contrast(120%)' },
  { name: 'Matrix', filter: 'sepia(1) hue-rotate(70deg) saturate(300%) contrast(120%)' },
  { name: 'Ocean', filter: 'sepia(1) hue-rotate(180deg) saturate(200%) contrast(110%)' },
  { name: 'Blood', filter: 'sepia(1) hue-rotate(320deg) saturate(400%) contrast(150%)' }
];
