"use client";

import React, { useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { ArrowRight, ArrowDown, CloudUpload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AuroraText } from "@/components/ui/aurora-text";
import { ScrollVelocityContainer, ScrollVelocityRow } from "@/components/ui/scroll-based-velocity";
import { AnimatedBeam } from "@/components/ui/animated-beam";
import { colorThemes } from "@/lib/data";
import { usePlayer } from "@/components/providers/player-provider";

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
          <Image src="/images/team/Tom_Protait_Professionell.jpeg" alt="Tom" width={150} height={150} className="w-full h-full object-cover opacity-70 group-hover:opacity-100 transition-opacity grayscale group-hover:grayscale-0" unoptimized />
          <span className="absolute -left-14 text-[10px] font-bold text-zinc-500 uppercase tracking-widest group-hover:text-white transition-colors">Tom</span>
        </div>
        <div ref={carlosRef} className="w-14 h-14 rounded-full bg-zinc-900 border-2 border-zinc-700 flex items-center justify-center overflow-hidden z-10 relative group cursor-pointer hover:border-white transition-colors">
          <Image src="/images/team/Carlos_Protait_Professionell.jpeg" alt="Carlos" width={150} height={150} className="w-full h-full object-cover opacity-70 group-hover:opacity-100 transition-opacity grayscale group-hover:grayscale-0" unoptimized />
          <span className="absolute -left-16 text-[10px] font-bold text-zinc-500 uppercase tracking-widest group-hover:text-white transition-colors">Carlos</span>
        </div>
        <div ref={juliusRef} className="w-14 h-14 rounded-full bg-zinc-900 border-2 border-zinc-700 flex items-center justify-center overflow-hidden z-10 relative group cursor-pointer hover:border-white transition-colors">
          <Image src="/images/team/Julius_Protait_Professionell.jpeg" alt="Julius" width={150} height={150} className="w-full h-full object-cover opacity-70 group-hover:opacity-100 transition-opacity grayscale group-hover:grayscale-0" unoptimized />
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

export function LandingPage() {
  const [isGlitching, setIsGlitching] = useState(false);
  const { setThemeIndex } = usePlayer();

  return (
    <div className="flex-1 flex flex-col overflow-y-auto bg-black text-white selection:bg-zinc-800 font-sans animate-in fade-in duration-500 scroll-smooth pb-24 no-scrollbar">
      {/* HERO SECTION (Full Screen) */}
      <section className="relative h-screen shrink-0 flex flex-col items-center justify-center overflow-hidden">
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

            <Link href="/login">
              <Button 
                className="group bg-white hover:bg-zinc-200 text-black h-16 px-10 rounded-full text-lg font-bold tracking-wider uppercase transition-all shadow-[0_0_40px_-10px_rgba(255,255,255,0.2)] hover:shadow-[0_0_60px_-15px_rgba(255,255,255,0.4)] active:scale-95"
              >
                Access Archive
                <ArrowRight className="w-5 h-5 ml-3 group-hover:translate-x-1 transition-transform" />
              </Button>
            </Link>
          </div>
        </div>

        {/* Scroll Indicator */}
        <div className="relative z-10 pb-10 flex flex-col items-center animate-bounce text-zinc-600 mt-auto pointer-events-none">
          <span className="text-[10px] uppercase tracking-widest font-bold mb-2">Our Story</span>
          <ArrowDown className="w-4 h-4" />
        </div>
      </section>

      {/* ABOUT US SECTION */}
      <section className="relative z-10 py-32 px-6 bg-black border-t border-zinc-900">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            {/* Text Side */}
            <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-left-8 duration-1000">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-zinc-800 bg-zinc-900/50 w-fit">
                <span className="text-xs font-medium uppercase tracking-widest text-zinc-400">
                  Who we are
                </span>
              </div>
              <h2 className="text-4xl md:text-5xl font-black tracking-tight leading-tight">
                From Münster <br />
                <span className="text-zinc-500">to the Cloud.</span>
              </h2>
              <div className="text-zinc-400 text-lg leading-relaxed space-y-6">
                <p>
                  We are a passionate team of three Wirtschaftsinformatik (WI) students from the University of Münster. What started as late-night coding sessions and a shared love for electronic music quickly evolved into a mission.
                </p>
                <p>
                  Frustrated by the limitations of existing DJ platforms and cloud storage solutions, we decided to build our own. DJ-CLOUD is our vision of the perfect collaborative vault—engineered with German precision, designed for professional audio, and built to withstand the heaviest drops.
                </p>
              </div>
              <div className="pt-4 flex gap-8">
                <div>
                  <h4 className="text-3xl font-black text-white">2026</h4>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 mt-1">Founded</p>
                </div>
                <div>
                  <h4 className="text-3xl font-black text-white">Uni MS</h4>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 mt-1">Roots</p>
                </div>
                <div>
                  <h4 className="text-3xl font-black text-white">100%</h4>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 mt-1">Lossless</p>
                </div>
              </div>
            </div>
            
            {/* Image Side */}
            <div className="relative group rounded-[2rem] overflow-hidden border border-zinc-800/50 shadow-2xl animate-in fade-in slide-in-from-right-8 duration-1000">
              <div className="absolute inset-0 bg-zinc-900/20 group-hover:bg-transparent transition-colors z-10 duration-500"></div>
              <Image 
                src="/images/team/Teamfoto_chillig.jpeg" 
                alt="DJ-CLOUD Team Chill" 
                width={800} 
                height={800} 
                className="w-full h-auto object-cover aspect-square md:aspect-[4/3] grayscale-[30%] group-hover:grayscale-0 group-hover:scale-105 transition-all duration-1000" 
                unoptimized 
              />
            </div>
          </div>
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
              <div className="w-16 h-16 rounded-2xl bg-zinc-800 flex items-center justify-center mb-6 overflow-hidden border border-zinc-700 shadow-lg group-hover:scale-110 transition-transform">
                <Image src="/images/team/Tom_Protait_Professionell.jpeg" alt="Tom" width={64} height={64} className="w-full h-full object-cover" unoptimized />
              </div>
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
              <div className="w-16 h-16 rounded-2xl bg-zinc-800 flex items-center justify-center mb-6 overflow-hidden border border-zinc-700 shadow-lg group-hover:scale-110 transition-transform">
                <Image src="/images/team/Carlos_Protait_Professionell.jpeg" alt="Carlos" width={64} height={64} className="w-full h-full object-cover" unoptimized />
              </div>
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
              <div className="w-16 h-16 rounded-2xl bg-zinc-800 flex items-center justify-center mb-6 overflow-hidden border border-zinc-700 shadow-lg group-hover:scale-110 transition-transform">
                <Image src="/images/team/Julius_Protait_Professionell.jpeg" alt="Julius" width={64} height={64} className="w-full h-full object-cover" unoptimized />
              </div>
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

          {/* TEAM PHOTO */}
          <div className="mt-16 w-full max-w-5xl mx-auto rounded-[2rem] overflow-hidden relative group border border-zinc-800/50 shadow-2xl">
            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent z-10 transition-opacity group-hover:opacity-80"></div>
            <Image 
              src="/images/team/Teamsfoto_Studio.jpeg" 
              alt="DJ-CLOUD Team" 
              width={1200} 
              height={600} 
              className="w-full h-auto object-cover opacity-80 group-hover:opacity-100 group-hover:scale-105 transition-all duration-1000" 
              unoptimized 
            />
            <div className="absolute bottom-8 left-8 right-8 z-20 flex flex-col md:flex-row justify-between items-start md:items-end gap-4 transition-transform duration-500 group-hover:translate-y-[-8px]">
              <div>
                <h3 className="text-2xl md:text-3xl font-black text-white mb-2 tracking-tight">The DJ-CLOUD Collective</h3>
                <p className="text-zinc-300 text-sm md:text-base max-w-xl">
                  Building the ultimate platform for DJs, producers, and audio enthusiasts. High quality, end-to-end.
                </p>
              </div>
            </div>
          </div>

        </div>
      </section>

      {/* BEHIND THE SCENES / CALL TO ACTION */}
      <section className="relative z-10 py-32 md:py-48 px-6 border-t border-zinc-900 overflow-hidden flex flex-col items-center justify-center text-center">
        {/* Background Image */}
        <div className="absolute inset-0 z-0">
          <Image 
            src="/images/team/Teamsfoto_busy.jpeg" 
            alt="Behind the scenes" 
            fill 
            className="object-cover opacity-50 scale-105" 
            unoptimized 
          />
          {/* Gradient Overlays */}
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent"></div>
          <div className="absolute inset-0 bg-gradient-to-b from-black via-transparent to-transparent"></div>
        </div>

        {/* Content */}
        <div className="relative z-10 max-w-2xl mx-auto flex flex-col items-center mb-10">
          <span className="text-zinc-500 text-xs font-bold uppercase tracking-[0.3em] mb-4">Behind the Scenes</span>
          <h2 className="text-4xl md:text-6xl font-black tracking-tight mb-6 text-white">Work Hard, <br /><span className="text-zinc-500">Play Harder.</span></h2>
          <p className="text-zinc-400 text-lg mb-12">
            Ready to join the session? Upload your tracks, sync your metadata, and collaborate with the crew in real-time.
          </p>
          <div className="pb-8">
            <Link href="/login" className="inline-block">
              <Button 
                className="group bg-white hover:bg-zinc-200 text-black h-16 px-10 rounded-full text-lg font-bold tracking-wider uppercase transition-all shadow-[0_0_40px_-10px_rgba(255,255,255,0.2)] hover:shadow-[0_0_60px_-15px_rgba(255,255,255,0.4)] active:scale-95"
              >
                Go to Shared Library
                <ArrowRight className="w-5 h-5 ml-3 group-hover:translate-x-1 transition-transform" />
              </Button>
            </Link>
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
  );
}
