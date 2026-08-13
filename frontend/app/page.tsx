"use client";

import React, { useState, useRef, useEffect } from "react";
import { 
  Play, Pause, SkipForward, SkipBack, Volume2, 
  Download, Pencil, Trash, SlidersHorizontal, CloudUpload, 
  Link as LinkIcon, Music2, Users, Search, MoreHorizontal, 
  Settings2, Library, ListMusic, Disc3, Plus, LayoutGrid, 
  ArrowRight, ArrowDown, ArrowUpDown, ChevronUp, ChevronDown
} from "lucide-react";

import { AuroraText } from "@/components/ui/aurora-text";
import { ScrollVelocityContainer, ScrollVelocityRow } from "@/components/ui/scroll-based-velocity";
import { AnimatedBeam } from "@/components/ui/animated-beam";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";

// Mock Data
const mockTracks = [
  { id: 1, title: "Losing It", artist: "FISHER", bpm: 125, key: "Am", uploadedBy: "Tom", format: "MP3", stems: "Ready", duration: "4:08", genre: "Tech House", playlist: "Peak Time" },
  { id: 2, title: "Innerbloom", artist: "RÜFÜS DU SOL", bpm: 122, key: "Em", uploadedBy: "Carlos", format: "WAV", stems: "Processing", duration: "9:38", genre: "Deep House", playlist: "Warmup" },
  { id: 3, title: "Bangarang", artist: "Skrillex", bpm: 110, key: "Gm", uploadedBy: "Julius", format: "MP3", stems: "Ready", duration: "3:35", genre: "Dubstep", playlist: "Peak Time" },
  { id: 4, title: "Levels", artist: "Avicii", bpm: 126, key: "C#m", uploadedBy: "Carlos", format: "WAV", stems: "Ready", duration: "5:38", genre: "Progressive", playlist: "Classics" },
  { id: 5, title: "Opus", artist: "Eric Prydz", bpm: 126, key: "Fm", uploadedBy: "Tom", format: "MP3", stems: "Failed", duration: "9:03", genre: "Progressive", playlist: "Peak Time" },
  { id: 6, title: "Strobe", artist: "deadmau5", bpm: 128, key: "F#m", uploadedBy: "Julius", format: "WAV", stems: "Ready", duration: "10:37", genre: "Progressive", playlist: "Classics" },
];

const playlists = ["Peak Time", "Warmup", "Classics"];
const genres = ["Tech House", "Deep House", "Progressive", "Dubstep"];

// Themes for Easter Egg
const colorThemes = [
  { name: 'Default', filter: 'none' },
  { name: 'Cyberpunk', filter: 'sepia(1) hue-rotate(250deg) saturate(300%) contrast(120%)' },
  { name: 'Matrix', filter: 'sepia(1) hue-rotate(70deg) saturate(300%) contrast(120%)' },
  { name: 'Ocean', filter: 'sepia(1) hue-rotate(180deg) saturate(200%) contrast(110%)' },
  { name: 'Blood', filter: 'sepia(1) hue-rotate(320deg) saturate(400%) contrast(150%)' }
];

function NetworkAnimation() {
  const containerRef = useRef<HTMLDivElement>(null);
  const tomRef = useRef<HTMLDivElement>(null);
  const carlosRef = useRef<HTMLDivElement>(null);
  const juliusRef = useRef<HTMLDivElement>(null);
  const vaultRef = useRef<HTMLDivElement>(null);

  return (
    <div ref={containerRef} className="relative flex w-full max-w-3xl items-center justify-between p-8 h-64 mx-auto mb-16 bg-zinc-900/20 rounded-[2rem] border border-zinc-800/50 backdrop-blur-sm">
      {/* Left side: DJs */}
      <div className="flex flex-col justify-between h-full gap-6 z-10">
        <div ref={tomRef} className="w-14 h-14 rounded-full bg-zinc-900 border-2 border-zinc-700 flex items-center justify-center overflow-hidden z-10 relative group cursor-pointer hover:border-white transition-colors">
          <img src="https://i.pravatar.cc/150?u=tom" alt="Tom" className="w-full h-full object-cover opacity-70 group-hover:opacity-100 transition-opacity grayscale group-hover:grayscale-0" />
          <span className="absolute -left-14 text-[10px] font-bold text-zinc-500 uppercase tracking-widest group-hover:text-white transition-colors">Tom</span>
        </div>
        <div ref={carlosRef} className="w-14 h-14 rounded-full bg-zinc-900 border-2 border-zinc-700 flex items-center justify-center overflow-hidden z-10 relative group cursor-pointer hover:border-white transition-colors">
          <img src="https://i.pravatar.cc/150?u=carlos" alt="Carlos" className="w-full h-full object-cover opacity-70 group-hover:opacity-100 transition-opacity grayscale group-hover:grayscale-0" />
          <span className="absolute -left-16 text-[10px] font-bold text-zinc-500 uppercase tracking-widest group-hover:text-white transition-colors">Carlos</span>
        </div>
        <div ref={juliusRef} className="w-14 h-14 rounded-full bg-zinc-900 border-2 border-zinc-700 flex items-center justify-center overflow-hidden z-10 relative group cursor-pointer hover:border-white transition-colors">
          <img src="https://i.pravatar.cc/150?u=julius" alt="Julius" className="w-full h-full object-cover opacity-70 group-hover:opacity-100 transition-opacity grayscale group-hover:grayscale-0" />
          <span className="absolute -left-16 text-[10px] font-bold text-zinc-500 uppercase tracking-widest group-hover:text-white transition-colors">Julius</span>
        </div>
      </div>

      {/* Right side: Cloud Vault */}
      <div ref={vaultRef} className="w-24 h-24 rounded-3xl bg-white text-black flex items-center justify-center z-10 shadow-[0_0_40px_-10px_rgba(255,255,255,0.5)]">
        <CloudUpload className="w-10 h-10" />
      </div>

      {/* Beams */}
      <AnimatedBeam containerRef={containerRef} fromRef={tomRef} toRef={vaultRef} curvature={40} duration={3} gradientStartColor="#52525b" gradientStopColor="#ffffff" pathColor="#18181b" />
      <AnimatedBeam containerRef={containerRef} fromRef={carlosRef} toRef={vaultRef} curvature={0} duration={4} delay={1} gradientStartColor="#52525b" gradientStopColor="#ffffff" pathColor="#18181b" />
      <AnimatedBeam containerRef={containerRef} fromRef={juliusRef} toRef={vaultRef} curvature={-40} duration={3.5} delay={2} gradientStartColor="#52525b" gradientStopColor="#ffffff" pathColor="#18181b" />
    </div>
  );
}

export default function DJCloudApp() {
  const [view, setView] = useState<'library' | 'hero'>('library');
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTrack, setCurrentTrack] = useState(mockTracks[0]);
  const [stemsOpen, setStemsOpen] = useState(false);
  const [activeFilter, setActiveFilter] = useState<{ type: 'all' | 'playlist' | 'genre', value: string }>({ type: 'all', value: 'All Tracks' });
  const [sortConfig, setSortConfig] = useState<{ key: keyof typeof mockTracks[0], direction: 'asc' | 'desc' } | null>(null);
  
  // Easter Egg States
  const [raveMode, setRaveMode] = useState(false);
  const [isGlitching, setIsGlitching] = useState(false);
  const [scratching, setScratching] = useState(false);
  const [themeIndex, setThemeIndex] = useState(0);

  // Easter Egg 1: Konami Code
  useEffect(() => {
    const konamiCode = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a'];
    let konamiIndex = 0;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === konamiCode[konamiIndex]) {
        konamiIndex++;
        if (konamiIndex === konamiCode.length) {
          setRaveMode(prev => !prev);
          konamiIndex = 0;
        }
      } else {
        konamiIndex = 0;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Filter tracks based on active selection
  const filteredTracks = mockTracks.filter(track => {
    if (activeFilter.type === 'all') return true;
    if (activeFilter.type === 'playlist') return track.playlist === activeFilter.value;
    if (activeFilter.type === 'genre') return track.genre === activeFilter.value;
    return true;
  });

  // Sort tracks
  const sortedTracks = [...filteredTracks].sort((a, b) => {
    if (!sortConfig) return 0;
    const { key, direction } = sortConfig;
    if (a[key] < b[key]) return direction === 'asc' ? -1 : 1;
    if (a[key] > b[key]) return direction === 'asc' ? 1 : -1;
    return 0;
  });

  const handleSort = (key: keyof typeof mockTracks[0]) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const renderSortIcon = (key: keyof typeof mockTracks[0]) => {
    if (sortConfig?.key !== key) return <ArrowUpDown className="w-3 h-3 ml-1 opacity-20 group-hover:opacity-100 transition-opacity" />;
    if (sortConfig.direction === 'asc') return <ChevronUp className="w-3 h-3 ml-1 text-white" />;
    return <ChevronDown className="w-3 h-3 ml-1 text-white" />;
  };

  return (
    <div 
      className={`transition-all duration-1000 ${raveMode ? 'rave-active' : ''}`}
      style={{ filter: !raveMode ? colorThemes[themeIndex].filter : undefined }}
    >
      {/* EASTER EGG CSS */}
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes rave {
          0% { filter: hue-rotate(0deg) saturate(250%) contrast(120%); }
          100% { filter: hue-rotate(360deg) saturate(250%) contrast(120%); }
        }
        .rave-active {
          animation: rave 1.5s linear infinite;
        }
      `}} />

      {/* --- HERO VIEW --- */}
      {view === 'hero' && (
        <div className="flex flex-col min-h-screen bg-black text-white selection:bg-zinc-800 font-sans animate-in fade-in duration-500 scroll-smooth">
          
          {/* HERO SECTION (Full Screen) */}
          <section className="relative h-screen flex flex-col items-center justify-center overflow-hidden">
            {/* Background glow */}
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-zinc-900/30 via-black to-black z-0 pointer-events-none"></div>

            {/* Diagonal Scrolling Text Background */}
            <div className="absolute inset-0 z-0 flex flex-col justify-center opacity-20 rotate-[-5deg] scale-110 pointer-events-none gap-8">
               <ScrollVelocityContainer>
                  <ScrollVelocityRow className="text-6xl md:text-9xl font-black text-transparent tracking-tighter uppercase" style={{ WebkitTextStroke: '2px #52525b' }} baseVelocity={-1}>
                    &nbsp;• HIGH QUALITY AUDIO • STEM SEPARATION • LOSSLESS PLAYBACK
                  </ScrollVelocityRow>
               </ScrollVelocityContainer>
               <ScrollVelocityContainer>
                  <ScrollVelocityRow className="text-6xl md:text-9xl font-black text-zinc-800 tracking-tighter uppercase" baseVelocity={1.5}>
                    &nbsp;• COLLABORATIVE VAULT • BPM DETECTION • 320 KBPS MP3
                  </ScrollVelocityRow>
               </ScrollVelocityContainer>
               <ScrollVelocityContainer>
                  <ScrollVelocityRow className="text-6xl md:text-9xl font-black text-transparent tracking-tighter uppercase" style={{ WebkitTextStroke: '2px #52525b' }} baseVelocity={-1.2}>
                    &nbsp;• CLOUD SYNC • METADATA EDITOR • PRO DJ TOOLS
                  </ScrollVelocityRow>
               </ScrollVelocityContainer>
            </div>

            {/* Foreground Content */}
            <div className="relative z-10 flex flex-col items-center justify-center flex-1 w-full px-6 pt-10">
              <div className="flex flex-col items-center text-center max-w-4xl animate-in fade-in zoom-in-95 duration-1000">
                
                {/* Easter Egg 3: Glitch Badge */}
                <div 
                  onMouseEnter={() => setIsGlitching(true)}
                  onMouseLeave={() => setIsGlitching(false)}
                  className={`inline-flex items-center gap-2 px-3 py-1 rounded-full border border-zinc-800 bg-zinc-900/50 backdrop-blur-md mb-8 cursor-pointer transition-all ${isGlitching ? 'bg-red-950/80 border-red-500 scale-110 skew-x-12' : ''}`}
                >
                  <span className="relative flex h-2 w-2">
                    <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${isGlitching ? 'bg-red-500' : 'bg-zinc-400'}`}></span>
                    <span className={`relative inline-flex rounded-full h-2 w-2 ${isGlitching ? 'bg-red-500' : 'bg-white'}`}></span>
                  </span>
                  <span className={`text-xs font-medium uppercase tracking-widest ${isGlitching ? 'text-red-500 font-black animate-pulse' : 'text-zinc-300'}`}>
                    {isGlitching ? 'BASS CANNON ARMED' : 'System Online'}
                  </span>
                </div>

                <h1 className="text-6xl md:text-[8rem] font-black tracking-tighter leading-none mb-6">
                  <AuroraText colors={["#ffffff", "#d4d4d8", "#52525b", "#ffffff"]}>DJ-CLOUD</AuroraText>
                </h1>
                
                <p className="text-zinc-400 text-lg md:text-xl font-medium tracking-[0.2em] uppercase mb-12 max-w-2xl leading-relaxed">
                   The next-generation collaborative vault for professional audio and stems.
                </p>

                <Button 
                  onClick={() => setView('library')} 
                  className="group bg-white hover:bg-zinc-200 text-black h-16 px-10 rounded-full text-lg font-bold tracking-wider uppercase transition-all shadow-[0_0_40px_-10px_rgba(255,255,255,0.2)] hover:shadow-[0_0_60px_-15px_rgba(255,255,255,0.4)] active:scale-95"
                >
                  Access Archive
                  <ArrowRight className="w-5 h-5 ml-3 group-hover:translate-x-1 transition-transform" />
                </Button>
              </div>
            </div>

            {/* Scroll Indicator */}
            <div className="relative z-10 pb-10 flex flex-col items-center animate-bounce text-zinc-600 mt-auto pointer-events-none">
              <span className="text-[10px] uppercase tracking-widest font-bold mb-2">Meet the Collective</span>
              <ArrowDown className="w-4 h-4" />
            </div>
          </section>

          {/* MEET THE COLLECTIVE & ANIMATION SECTION */}
          <section className="relative z-10 py-32 px-6 bg-black border-t border-zinc-900">
            <div className="max-w-7xl mx-auto">
              
              <div className="text-center mb-16">
                <h2 className="text-4xl md:text-6xl font-black tracking-tight mb-6">Synced to the <span className="text-zinc-500">Vault.</span></h2>
                <p className="text-zinc-400 text-lg md:text-xl max-w-2xl mx-auto mb-10">
                  Direct uploads from our setups to a unified, lossless archive.
                </p>
              </div>

              {/* Network Upload Animation */}
              <NetworkAnimation />

              <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-24">
                {/* TOM */}
                <div className="bg-zinc-900/40 border border-zinc-800/80 rounded-3xl p-8 hover:bg-zinc-900 transition-colors group relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-zinc-800/20 rounded-full blur-3xl -mr-10 -mt-10 group-hover:bg-white/5 transition-colors"></div>
                  <div className="w-16 h-16 rounded-2xl bg-zinc-800 text-white flex items-center justify-center mb-6 text-2xl font-black border border-zinc-700 shadow-lg group-hover:scale-110 transition-transform">T</div>
                  <h3 className="text-2xl font-bold mb-1">Tom</h3>
                  <p className="text-[10px] text-zinc-500 font-bold tracking-widest uppercase mb-4">The Architect • Traktor Pro</p>
                  <p className="text-zinc-400 text-sm leading-relaxed mb-6">
                    The mastermind who originally coded this platform. By day, he&apos;s a serious Java developer prioritizing his studies and keeping our servers alive. By night, he&apos;s a veteran on the decks dropping absolute bombs.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <span className="text-[10px] font-semibold bg-black border border-zinc-800 px-2.5 py-1 rounded text-zinc-300">Schranz (Main)</span>
                    <span className="text-[10px] font-semibold bg-black border border-zinc-800 px-2.5 py-1 rounded text-zinc-300">Drum & Bass</span>
                    <span className="text-[10px] font-semibold bg-black border border-zinc-800 px-2.5 py-1 rounded text-zinc-300">Tech House</span>
                  </div>
                </div>

                {/* CARLOS */}
                <div className="bg-zinc-900/40 border border-zinc-800/80 rounded-3xl p-8 hover:bg-zinc-900 transition-colors group relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-zinc-800/20 rounded-full blur-3xl -mr-10 -mt-10 group-hover:bg-white/5 transition-colors"></div>
                  <div className="w-16 h-16 rounded-2xl bg-zinc-800 text-white flex items-center justify-center mb-6 text-2xl font-black border border-zinc-700 shadow-lg group-hover:scale-110 transition-transform">C</div>
                  <h3 className="text-2xl font-bold mb-1">Carlos</h3>
                  <p className="text-[10px] text-zinc-500 font-bold tracking-widest uppercase mb-4">The Busy Bee • CDJ 400</p>
                  <p className="text-zinc-400 text-sm leading-relaxed mb-6">
                    Always on the run and rarely finds time to spin—but when he does, it&apos;s pure groove. Rocking the legendary Pioneer CDJ 400s, he recently caught the heavy D&B bug directly from Tom.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <span className="text-[10px] font-semibold bg-black border border-zinc-800 px-2.5 py-1 rounded text-zinc-300">House Remixes</span>
                    <span className="text-[10px] font-semibold bg-black border border-zinc-800 px-2.5 py-1 rounded text-zinc-300">Bounce & Trance</span>
                    <span className="text-[10px] font-semibold bg-black border border-zinc-800 px-2.5 py-1 rounded text-zinc-300">Tech House</span>
                  </div>
                </div>

                {/* JULIUS */}
                <div className="bg-zinc-900/40 border border-zinc-800/80 rounded-3xl p-8 hover:bg-zinc-900 transition-colors group relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-zinc-800/20 rounded-full blur-3xl -mr-10 -mt-10 group-hover:bg-white/5 transition-colors"></div>
                  <div className="w-16 h-16 rounded-2xl bg-zinc-800 text-white flex items-center justify-center mb-6 text-2xl font-black border border-zinc-700 shadow-lg group-hover:scale-110 transition-transform">J</div>
                  <h3 className="text-2xl font-bold mb-1">Julius</h3>
                  <p className="text-[10px] text-zinc-500 font-bold tracking-widest uppercase mb-4">The Wildcard • Traktor</p>
                  <p className="text-zinc-400 text-sm leading-relaxed mb-6">
                    The newest member to join the decks, but don&apos;t let that fool you. Armed with a solid Traktor setup, he&apos;s an absolute wildcard who will seamlessly mix literally anything that makes the crowd move.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <span className="text-[10px] font-semibold bg-black border border-zinc-800 px-2.5 py-1 rounded text-zinc-300">Drum & Bass</span>
                    <span className="text-[10px] font-semibold bg-black border border-zinc-800 px-2.5 py-1 rounded text-zinc-300">Schranz</span>
                    <span className="text-[10px] font-semibold bg-black border border-zinc-800 px-2.5 py-1 rounded text-zinc-300">Everything Else</span>
                  </div>
                </div>
              </div>

              <div className="mt-24 text-center">
                 <Button 
                  onClick={() => setView('library')} 
                  className="bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-white h-14 px-10 rounded-full text-sm font-bold tracking-widest uppercase transition-all"
                >
                  Go to Shared Library
                </Button>
              </div>
            </div>
          </section>

          {/* Footer */}
          <footer className="py-6 px-8 text-center border-t border-zinc-900 text-[10px] text-zinc-600 uppercase tracking-widest font-black bg-black flex justify-between items-center flex-col md:flex-row gap-4 relative z-10">
            <span>DJ-CLOUD © 2026</span>
            {/* Hidden Theme Switcher Trigger */}
            <span 
              className="cursor-crosshair hover:text-zinc-400 transition-colors"
              onClick={() => setThemeIndex((prev) => (prev + 1) % colorThemes.length)}
            >
              v2.0.4 Beta • End-To-End Encrypted
            </span>
          </footer>
        </div>
      )}

      {/* --- DASHBOARD VIEW (AUTHENTICATED) --- */}
      {view === 'library' && (
        <div className="flex h-screen bg-black text-zinc-300 font-sans overflow-hidden selection:bg-zinc-800 animate-in fade-in duration-500">
          
          {/* SIDEBAR */}
          <aside className="w-64 border-r border-zinc-900 bg-black flex flex-col hidden md:flex">
            {/* Brand */}
            <div className="h-20 flex items-center px-6 border-b border-zinc-900 cursor-pointer group" onClick={() => setView('hero')}>
              <h1 className="text-xl font-black tracking-tighter group-hover:scale-105 transition-transform origin-left">
                <AuroraText colors={["#ffffff", "#a1a1aa", "#52525b", "#ffffff"]}>DJ-CLOUD</AuroraText>
              </h1>
            </div>

            <div className="flex-1 overflow-y-auto py-6 px-4 space-y-8 no-scrollbar">
              {/* Main Navigation */}
              <div className="space-y-1">
                <button 
                  onClick={() => setActiveFilter({ type: 'all', value: 'All Tracks' })}
                  className={`w-full flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-md transition-colors ${activeFilter.type === 'all' ? 'bg-zinc-900 text-white' : 'hover:bg-zinc-900/50 hover:text-white'}`}
                >
                  <Library className="w-4 h-4" />
                  All Tracks
                </button>
                <button className="w-full flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-md transition-colors hover:bg-zinc-900/50 hover:text-white">
                  <LayoutGrid className="w-4 h-4" />
                  Recently Added
                </button>
              </div>

              {/* Playlists */}
              <div>
                <div className="flex items-center justify-between px-3 mb-2">
                  <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Playlists</h2>
                  <button className="text-zinc-500 hover:text-white transition-colors">
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
                <div className="space-y-0.5">
                  {playlists.map(pl => (
                    <button 
                      key={pl}
                      onClick={() => setActiveFilter({ type: 'playlist', value: pl })}
                      className={`w-full flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-md transition-colors ${activeFilter.type === 'playlist' && activeFilter.value === pl ? 'bg-zinc-900 text-white' : 'text-zinc-400 hover:bg-zinc-900/50 hover:text-white'}`}
                    >
                      <ListMusic className="w-4 h-4" />
                      {pl}
                    </button>
                  ))}
                </div>
              </div>

              {/* Genres */}
              <div>
                <h2 className="px-3 mb-2 text-xs font-semibold text-zinc-500 uppercase tracking-wider">Genres</h2>
                <div className="space-y-0.5">
                  {genres.map(g => (
                    <button 
                      key={g}
                      onClick={() => setActiveFilter({ type: 'genre', value: g })}
                      className={`w-full flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-md transition-colors ${activeFilter.type === 'genre' && activeFilter.value === g ? 'bg-zinc-900 text-white' : 'text-zinc-400 hover:bg-zinc-900/50 hover:text-white'}`}
                    >
                      <Disc3 className="w-4 h-4" />
                      {g}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* User / Team Status */}
            <div className="p-4 border-t border-zinc-900">
              <div className="flex items-center gap-3 px-2 py-2 rounded-md bg-zinc-900/50 border border-zinc-800/50">
                <div className="relative flex h-2.5 w-2.5 ml-1">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-zinc-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-zinc-300"></span>
                </div>
                <div className="flex flex-col">
                  <span className="text-xs font-medium text-white">3 DJs Online</span>
                  <span className="text-[10px] text-zinc-500">Shared Archive Active</span>
                </div>
              </div>
            </div>
          </aside>

          {/* MAIN CONTENT AREA */}
          <main className="flex-1 flex flex-col min-w-0 bg-zinc-950/30 relative">
            
            {/* Header */}
            <header className="h-20 flex items-center justify-between px-8 border-b border-zinc-900 bg-black/50 backdrop-blur-xl sticky top-0 z-10">
              <div className="flex items-center gap-4 flex-1">
                <div className="relative w-full max-w-md group">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 group-focus-within:text-white transition-colors" />
                  <Input 
                    placeholder="Search archive..." 
                    className="pl-9 bg-black border-zinc-800 text-white focus-visible:ring-1 focus-visible:ring-zinc-700 focus-visible:border-zinc-700 transition-all rounded-md h-10 placeholder:text-zinc-600"
                  />
                </div>
              </div>
              <div className="flex items-center gap-4">
                <Dialog>
                  <DialogTrigger render={
                    <Button className="bg-white hover:bg-zinc-200 text-black gap-2 h-10 px-5 rounded-md font-medium transition-colors">
                      <CloudUpload className="w-4 h-4" />
                      Upload
                    </Button>
                  } />
                  <DialogContent className="bg-zinc-950 border-zinc-900 text-white sm:max-w-md rounded-xl p-6">
                    <DialogHeader className="mb-4">
                      <DialogTitle className="text-lg font-semibold">Add to Archive</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-6 py-2">
                      <div className="space-y-2">
                        <label className="text-xs font-medium text-zinc-400 uppercase tracking-wider">Link</label>
                        <div className="flex gap-2">
                          <Input placeholder="YouTube or SoundCloud URL..." className="bg-black border-zinc-800 rounded-md h-10 focus-visible:ring-zinc-700" />
                          <Button variant="secondary" className="bg-zinc-900 hover:bg-zinc-800 text-white rounded-md h-10 w-10 p-0 border border-zinc-800 shrink-0">
                            <LinkIcon className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                      <div className="relative flex justify-center">
                        <div className="absolute inset-0 flex items-center">
                          <span className="w-full border-t border-zinc-900" />
                        </div>
                        <div className="relative flex justify-center text-[10px] uppercase font-bold tracking-widest">
                          <span className="bg-zinc-950 px-4 text-zinc-600">Or</span>
                        </div>
                      </div>
                      <div className="border border-dashed border-zinc-800 rounded-xl p-8 flex flex-col items-center justify-center text-center gap-3 hover:border-zinc-600 hover:bg-zinc-900/50 transition-all cursor-pointer group bg-black/50">
                        <div className="w-10 h-10 rounded-full bg-zinc-900 flex items-center justify-center border border-zinc-800 group-hover:bg-zinc-800 transition-colors">
                          <CloudUpload className="w-5 h-5 text-zinc-400 group-hover:text-white" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-zinc-300">Drag & drop files</p>
                          <p className="text-xs text-zinc-600 mt-1">MP3, WAV, FLAC (Max 50MB)</p>
                        </div>
                      </div>
                    </div>
                    <DialogFooter className="mt-4">
                      <Button className="w-full bg-white hover:bg-zinc-200 text-black rounded-md h-10 text-sm font-medium">
                        Upload to Shared Library
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
            </header>

            {/* Content Area */}
            <div className="flex-1 overflow-y-auto pb-32">
              <div className="px-8 py-8">
                <h2 className="text-3xl font-bold text-white mb-8 tracking-tight">
                  {activeFilter.value}
                </h2>

                {/* Table */}
                <div className="rounded-xl border border-zinc-900 bg-black/50 overflow-hidden">
                  <Table>
                    <TableHeader className="bg-zinc-900/30 select-none">
                      <TableRow className="border-zinc-900 hover:bg-transparent">
                        <TableHead className="w-12 text-center h-11">#</TableHead>
                        <TableHead 
                          className="text-xs font-semibold uppercase tracking-wider text-zinc-500 cursor-pointer hover:text-white transition-colors group h-11"
                          onClick={() => handleSort('title')}
                        >
                          <div className="flex items-center">Title {renderSortIcon('title')}</div>
                        </TableHead>
                        <TableHead 
                          className="text-xs font-semibold uppercase tracking-wider text-zinc-500 cursor-pointer hover:text-white transition-colors group h-11"
                          onClick={() => handleSort('artist')}
                        >
                          <div className="flex items-center">Artist {renderSortIcon('artist')}</div>
                        </TableHead>
                        <TableHead 
                          className="text-xs font-semibold uppercase tracking-wider text-zinc-500 cursor-pointer hover:text-white transition-colors group h-11"
                          onClick={() => handleSort('bpm')}
                        >
                          <div className="flex items-center">BPM {renderSortIcon('bpm')}</div>
                        </TableHead>
                        <TableHead className="text-xs font-semibold uppercase tracking-wider text-zinc-500 h-11">Key</TableHead>
                        <TableHead className="text-xs font-semibold uppercase tracking-wider text-zinc-500 h-11">Format</TableHead>
                        <TableHead className="text-xs font-semibold uppercase tracking-wider text-zinc-500 h-11">Stems</TableHead>
                        <TableHead className="text-right text-xs font-semibold uppercase tracking-wider text-zinc-500 h-11">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sortedTracks.map((track, index) => (
                        <TableRow 
                          key={track.id} 
                          className={`border-zinc-900 hover:bg-zinc-900/40 group transition-colors cursor-pointer ${currentTrack.id === track.id ? 'bg-zinc-900/20' : ''}`}
                          onClick={() => {
                            setCurrentTrack(track);
                            setIsPlaying(true);
                          }}
                        >
                          <TableCell className="w-12 text-center text-zinc-600 relative">
                            <span className="group-hover:opacity-0 transition-opacity">{index + 1}</span>
                            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                              {currentTrack.id === track.id && isPlaying ? (
                                <Pause className="w-4 h-4 text-white" />
                              ) : (
                                <Play className="w-4 h-4 text-white fill-white" />
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="font-medium">
                            <span className={`text-sm ${currentTrack.id === track.id ? 'text-white' : 'text-zinc-200'}`}>
                              {track.title}
                            </span>
                          </TableCell>
                          <TableCell className="text-zinc-400 text-sm">{track.artist}</TableCell>
                          <TableCell className="text-zinc-400 text-sm font-mono">{track.bpm}</TableCell>
                          <TableCell>
                            <span className="text-xs font-mono text-zinc-300">
                              {track.key}
                            </span>
                          </TableCell>
                          <TableCell>
                            <span className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider px-1.5 py-0.5 rounded border border-zinc-800 bg-zinc-900">
                              {track.format}
                            </span>
                          </TableCell>
                          <TableCell>
                            <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">
                              {track.stems === 'Ready' && <span className="text-zinc-300 border border-zinc-700 bg-zinc-800 px-1.5 py-0.5 rounded">Ready</span>}
                              {track.stems === 'Processing' && <span className="text-zinc-500 border border-zinc-800 px-1.5 py-0.5 rounded flex items-center gap-1.5 w-fit"><span className="w-1 h-1 rounded-full bg-zinc-400 animate-pulse"></span>Proc</span>}
                              {track.stems === 'Failed' && <span className="text-zinc-600 border border-zinc-900 px-1.5 py-0.5 rounded line-through">Failed</span>}
                            </span>
                          </TableCell>
                          <TableCell className="text-right pr-4" onClick={(e) => e.stopPropagation()}>
                            <DropdownMenu>
                              <DropdownMenuTrigger render={
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-zinc-500 hover:text-white hover:bg-zinc-800 data-[state=open]:bg-zinc-800 data-[state=open]:text-white rounded-md">
                                  <MoreHorizontal className="w-4 h-4" />
                                </Button>
                              } />
                              <DropdownMenuContent align="end" className="w-48 bg-zinc-950 border-zinc-800 text-zinc-300 rounded-lg p-1 shadow-2xl">
                                <DropdownMenuItem className="focus:!bg-zinc-800 focus:!text-white hover:!bg-zinc-800 hover:!text-white cursor-pointer rounded-md py-2">
                                  <Download className="w-4 h-4 mr-2" /> <span className="text-sm">Download</span>
                                </DropdownMenuItem>
                                <DropdownMenuItem className="focus:!bg-zinc-800 focus:!text-white hover:!bg-zinc-800 hover:!text-white cursor-pointer rounded-md py-2">
                                  <Settings2 className="w-4 h-4 mr-2" /> <span className="text-sm">Stems Options</span>
                                </DropdownMenuItem>
                                <DropdownMenuSeparator className="bg-zinc-800 my-1" />
                                <DropdownMenuItem className="focus:!bg-zinc-800 focus:!text-white hover:!bg-zinc-800 hover:!text-white cursor-pointer rounded-md py-2">
                                  <Pencil className="w-4 h-4 mr-2" /> <span className="text-sm">Edit Info</span>
                                </DropdownMenuItem>
                                <DropdownMenuItem className="focus:!bg-red-950/50 focus:!text-red-400 hover:!bg-red-950/50 hover:!text-red-400 text-red-500 cursor-pointer rounded-md py-2">
                                  <Trash className="w-4 h-4 mr-2" /> <span className="text-sm">Delete</span>
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      ))}
                      {filteredTracks.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={8} className="h-32 text-center text-zinc-500">
                            No tracks found in this category.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </div>
          </main>

          {/* FIXED BOTTOM PLAYER */}
          <div className="fixed bottom-0 left-0 right-0 h-24 bg-black border-t border-zinc-900 z-50 flex items-center px-6 gap-8">
            {/* Track Info */}
            <div className="flex items-center gap-4 w-1/4 min-w-[240px]">
              
              {/* Easter Egg 4: Vinyl Spinning & Scratching */}
              <div 
                className={`relative w-14 h-14 rounded-md bg-zinc-900 flex items-center justify-center border border-zinc-800 overflow-hidden cursor-pointer ${scratching ? 'scale-110 skew-x-12' : 'transition-transform'}`}
                onMouseDown={() => setScratching(true)}
                onMouseUp={() => setScratching(false)}
                onMouseLeave={() => setScratching(false)}
              >
                {isPlaying && !scratching && (
                  <div className="absolute inset-0 bg-white/5 animate-pulse"></div>
                )}
                {isPlaying ? (
                  <Disc3 className={`w-8 h-8 text-zinc-300 ${scratching ? 'animate-none rotate-45 text-white' : 'animate-[spin_2s_linear_infinite]'}`} />
                ) : (
                  <Music2 className="w-5 h-5 text-zinc-600" />
                )}
              </div>

              <div className="flex flex-col truncate">
                <span className="font-medium text-white truncate text-sm">{currentTrack.title}</span>
                <span className="text-zinc-500 text-xs truncate mt-0.5">{currentTrack.artist}</span>
              </div>
            </div>

            {/* Player Controls */}
            <div className="flex-1 flex flex-col items-center justify-center gap-2 max-w-2xl">
              <div className="flex items-center gap-6">
                <button className="text-zinc-500 hover:text-white transition-colors">
                  <SkipBack className="w-4 h-4 fill-current" />
                </button>
                <button 
                  onClick={() => setIsPlaying(!isPlaying)}
                  className="w-10 h-10 flex items-center justify-center rounded-full bg-white hover:bg-zinc-200 text-black transition-all active:scale-95"
                >
                  {isPlaying ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current ml-1" />}
                </button>
                <button className="text-zinc-500 hover:text-white transition-colors">
                  <SkipForward className="w-4 h-4 fill-current" />
                </button>
              </div>
              <div className="flex items-center gap-3 w-full text-xs text-zinc-500 font-mono">
                <span>{isPlaying ? "1:24" : "0:00"}</span>
                <div className="group relative flex-1 h-1 flex items-center cursor-pointer">
                  <div className="absolute h-1 w-full bg-zinc-900 rounded-full overflow-hidden">
                    <div className="h-full bg-white w-1/3 rounded-full group-hover:bg-zinc-300 transition-colors"></div>
                  </div>
                  <div className="absolute h-3 w-3 bg-white rounded-full left-1/3 -ml-1.5 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                </div>
                <span>{currentTrack.duration}</span>
              </div>
            </div>

            {/* Right Controls (Volume + Stems) */}
            <div className="w-1/4 min-w-[240px] flex items-center justify-end gap-6">
              <div className="flex items-center gap-3 w-32 group">
                <Volume2 className="w-4 h-4 text-zinc-500 group-hover:text-zinc-400 transition-colors" />
                <Slider defaultValue={[80]} max={100} step={1} className="w-full" />
              </div>
              
              <Dialog open={stemsOpen} onOpenChange={setStemsOpen}>
                <DialogTrigger render={
                  <Button 
                    variant="outline" 
                    className={`gap-2 h-9 px-3 rounded-md text-xs font-medium border-zinc-800 bg-zinc-900 hover:bg-zinc-800 hover:text-white transition-all ${currentTrack.stems !== 'Ready' && 'opacity-50 pointer-events-none'}`}
                  >
                    <SlidersHorizontal className="w-3.5 h-3.5 text-zinc-400" />
                    Stems
                  </Button>
                } />
                <DialogContent className="bg-black border-zinc-900 text-white sm:max-w-md rounded-xl p-6">
                  <DialogHeader className="mb-6">
                    <DialogTitle className="flex items-center gap-3 text-lg font-medium">
                      <div className="w-8 h-8 rounded-md bg-zinc-900 flex items-center justify-center border border-zinc-800">
                        <SlidersHorizontal className="w-4 h-4 text-zinc-300" />
                      </div>
                      Stem Mixer
                    </DialogTitle>
                    <p className="text-sm text-zinc-500">Fine-tune elements for <span className="text-zinc-300">{currentTrack.title}</span></p>
                  </DialogHeader>
                  
                  <div className="space-y-4 py-2">
                    {["Vocals", "Drums", "Bass", "Melody"].map((stem) => (
                      <div key={stem} className="flex items-center gap-4 bg-zinc-950 p-3 rounded-lg border border-zinc-900">
                        <div className="w-16 text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                          {stem}
                        </div>
                        <Slider defaultValue={[100]} max={100} step={1} className="flex-1" />
                        <div className="flex gap-1.5">
                          <Button variant="ghost" size="icon" className="h-7 w-7 rounded-md text-[10px] font-bold bg-zinc-900 hover:bg-zinc-800 text-zinc-500 hover:text-white transition-colors border border-zinc-800">M</Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7 rounded-md text-[10px] font-bold bg-zinc-900 hover:bg-zinc-800 text-zinc-500 hover:text-white transition-colors border border-zinc-800">S</Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
