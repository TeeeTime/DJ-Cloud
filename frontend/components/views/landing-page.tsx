"use client";

import React, { useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { ArrowRight, ArrowDown, CloudUpload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AuroraText } from "@/components/ui/aurora-text";
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
  const scrollRef = useRef<HTMLDivElement>(null);

  return (
    <div ref={scrollRef} className="flex-1 flex flex-col overflow-y-auto bg-black text-white selection:bg-zinc-800 font-sans animate-in fade-in duration-500 scroll-smooth pb-24 no-scrollbar">
      {/* HERO SECTION (Full Screen) */}
      <section className="relative h-screen shrink-0 flex flex-col items-center justify-center overflow-hidden">
        {/* Background glow */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-zinc-900/30 via-black to-black z-0 pointer-events-none"></div>

        {/* Background glow removed scrolling text to clean up design */}

        {/* Foreground Content */}
        <div className="relative z-10 flex flex-col items-center justify-center flex-1 w-full px-6 pt-10">
          <div className="flex flex-col items-center text-center max-w-4xl animate-in fade-in zoom-in-95 duration-1000">
            
            {/* Easter Egg 3: Glitch Badge */}
            <div className="relative group/badge mb-8 cursor-pointer" onMouseEnter={() => setIsGlitching(true)} onMouseLeave={() => setIsGlitching(false)}>
              <div className={`absolute -inset-0.5 rounded-full blur opacity-30 group-hover/badge:opacity-100 transition duration-1000 group-hover/badge:duration-200 ${isGlitching ? 'bg-red-500' : 'bg-zinc-500'}`}></div>
              <div className={`relative inline-flex items-center gap-2 px-4 py-1.5 rounded-full border bg-black transition-all ${isGlitching ? 'border-red-500 scale-110 skew-x-12' : 'border-zinc-800'}`}>
                <span className="relative flex h-2 w-2">
                  <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${isGlitching ? 'bg-red-500' : 'bg-zinc-400'}`}></span>
                  <span className={`relative inline-flex rounded-full h-2 w-2 ${isGlitching ? 'bg-red-500' : 'bg-white'}`}></span>
                </span>
                <span className={`text-xs font-medium uppercase tracking-widest ${isGlitching ? 'text-red-500 font-black animate-pulse' : 'text-zinc-300'}`}>
                  {isGlitching ? 'BASS CANNON ARMED' : 'System Online'}
                </span>
              </div>
            </div>

            <h1 className="text-6xl md:text-[8rem] font-black tracking-tighter leading-none mb-6 group cursor-default">
              <span className="inline-block hover:scale-105 transition-transform duration-500"><AuroraText colors={["#ffffff", "#d4d4d8", "#52525b", "#ffffff"]}>DJ-CLOUD</AuroraText></span>
            </h1>
            
            <p className="text-zinc-400 text-lg md:text-xl font-medium tracking-[0.2em] uppercase mb-12 max-w-2xl leading-relaxed">
                The next-generation collaborative vault for professional audio and stems.
            </p>

            <div className="mt-8">
              <Link href="/login" className="inline-block">
                <Button 
                  className="group bg-white hover:bg-zinc-200 text-black h-16 px-10 rounded-full text-lg font-bold tracking-wider uppercase transition-all shadow-[0_0_40px_-10px_rgba(255,255,255,0.2)] hover:shadow-[0_0_60px_-15px_rgba(255,255,255,0.4)] active:scale-95"
                >
                  Access Archive
                  <ArrowRight className="w-5 h-5 ml-3 group-hover:translate-x-2 transition-transform" />
                </Button>
              </Link>
            </div>
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
            <div className="bg-zinc-900/40 border border-zinc-800/80 rounded-3xl p-8 hover:bg-zinc-900 transition-all duration-500 group relative overflow-hidden hover:-translate-y-4 hover:shadow-2xl hover:border-zinc-600">
              <div className="w-16 h-16 rounded-2xl bg-zinc-800 flex items-center justify-center mb-6 overflow-hidden border border-zinc-700 shadow-lg group-hover:scale-110 group-hover:rotate-3 transition-transform duration-500">
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
            <div className="bg-zinc-900/40 border border-zinc-800/80 rounded-3xl p-8 hover:bg-zinc-900 transition-all duration-500 group relative overflow-hidden hover:-translate-y-4 hover:shadow-2xl hover:border-zinc-600 delay-75">
              <div className="w-16 h-16 rounded-2xl bg-zinc-800 flex items-center justify-center mb-6 overflow-hidden border border-zinc-700 shadow-lg group-hover:scale-110 group-hover:-rotate-3 transition-transform duration-500">
                <Image src="/images/team/Carlos_Protait_Professionell.jpeg" alt="Carlos" width={64} height={64} className="w-full h-full object-cover" unoptimized />
              </div>
              <h3 className="text-2xl font-bold mb-1">Carlos</h3>
              <p className="text-[10px] text-zinc-500 font-bold tracking-widest uppercase mb-4">The Busy Bee • DDJ 400</p>
              <p className="text-zinc-400 text-sm leading-relaxed mb-6">
                Always otherwise occupied and rarely gets around to actually DJing. But when the stars align and his DDJ-400 is dusted off, it&apos;s pure groove. He recently caught the heavy D&B bug directly from Tom.
              </p>
              <div className="flex flex-wrap gap-2">
                <span className="text-[10px] font-semibold bg-black border border-zinc-800 px-2.5 py-1 rounded text-zinc-300">House Remixes</span>
                <span className="text-[10px] font-semibold bg-black border border-zinc-800 px-2.5 py-1 rounded text-zinc-300">Bounce & Trance</span>
                <span className="text-[10px] font-semibold bg-black border border-zinc-800 px-2.5 py-1 rounded text-zinc-300">Tech House</span>
              </div>
            </div>

            {/* JULIUS */}
            <div className="bg-zinc-900/40 border border-zinc-800/80 rounded-3xl p-8 hover:bg-zinc-900 transition-all duration-500 group relative overflow-hidden hover:-translate-y-4 hover:shadow-2xl hover:border-zinc-600 delay-150">
              <div className="w-16 h-16 rounded-2xl bg-zinc-800 flex items-center justify-center mb-6 overflow-hidden border border-zinc-700 shadow-lg group-hover:scale-110 group-hover:rotate-3 transition-transform duration-500">
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



        </div>
      </section>

      {/* FREQUENTLY ASKED QUESTIONS */}
      <section className="relative z-10 py-32 px-6 bg-black border-t border-zinc-900">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-black tracking-tight mb-4 text-white">Frequently Asked <span className="text-zinc-500">Questions</span></h2>
            <p className="text-zinc-400 text-lg">Very serious answers to very serious questions.</p>
          </div>
          
          <div className="space-y-4">
            <details className="group border border-zinc-800/80 bg-zinc-900/40 rounded-2xl overflow-hidden [&_summary::-webkit-details-marker]:hidden">
              <summary className="flex items-center justify-between p-6 cursor-pointer font-bold text-lg hover:bg-zinc-800/50 transition-colors text-white">
                <span>Darf ich auch Schlager hochladen?</span>
                <span className="transition group-open:rotate-180">
                  <ArrowDown className="w-5 h-5 text-zinc-500" />
                </span>
              </summary>
              <div className="p-6 pt-0 text-zinc-400 leading-relaxed border-t border-zinc-800/50 mt-2 pt-4">
                Nein. Wer Schlager in die Cloud lädt, dessen Account wird permanent gesperrt und sein USB-Stick formatiert. Keine Diskussion.
              </div>
            </details>

            <details className="group border border-zinc-800/80 bg-zinc-900/40 rounded-2xl overflow-hidden [&_summary::-webkit-details-marker]:hidden">
              <summary className="flex items-center justify-between p-6 cursor-pointer font-bold text-lg hover:bg-zinc-800/50 transition-colors text-white">
                <span>Warum ist Carlos nie am Pult zu sehen?</span>
                <span className="transition group-open:rotate-180">
                  <ArrowDown className="w-5 h-5 text-zinc-500" />
                </span>
              </summary>
              <div className="p-6 pt-0 text-zinc-400 leading-relaxed border-t border-zinc-800/50 mt-2 pt-4">
                Carlos ist chronisch "anderweitig beschäftigt". Wenn er doch mal Zeit findet, muss er erst seinen DDJ 400 entstauben und ein Rekordbox-Update installieren, was den restlichen Abend in Anspruch nimmt.
              </div>
            </details>

            <details className="group border border-zinc-800/80 bg-zinc-900/40 rounded-2xl overflow-hidden [&_summary::-webkit-details-marker]:hidden">
              <summary className="flex items-center justify-between p-6 cursor-pointer font-bold text-lg hover:bg-zinc-800/50 transition-colors text-white">
                <span>Was passiert, wenn Tom anfängt zu coden?</span>
                <span className="transition group-open:rotate-180">
                  <ArrowDown className="w-5 h-5 text-zinc-500" />
                </span>
              </summary>
              <div className="p-6 pt-0 text-zinc-400 leading-relaxed border-t border-zinc-800/50 mt-2 pt-4">
                Server stürzen ab, Datenbanken brennen, aber am Ende funktioniert es meistens irgendwie. Spring Boot regelt das schon.
              </div>
            </details>

            <details className="group border border-zinc-800/80 bg-zinc-900/40 rounded-2xl overflow-hidden [&_summary::-webkit-details-marker]:hidden">
              <summary className="flex items-center justify-between p-6 cursor-pointer font-bold text-lg hover:bg-zinc-800/50 transition-colors text-white">
                <span>Wie viele BPM braucht Tom um wach zu werden?</span>
                <span className="transition group-open:rotate-180">
                  <ArrowDown className="w-5 h-5 text-zinc-500" />
                </span>
              </summary>
              <div className="p-6 pt-0 text-zinc-400 leading-relaxed border-t border-zinc-800/50 mt-2 pt-4">
                Alles unter 150 BPM ist für Tom Ambient. Sein Morgenkaffee wird stilecht von harten Schranz-Kicks umgerührt.
              </div>
            </details>
            
            <details className="group border border-zinc-800/80 bg-zinc-900/40 rounded-2xl overflow-hidden [&_summary::-webkit-details-marker]:hidden">
              <summary className="flex items-center justify-between p-6 cursor-pointer font-bold text-lg hover:bg-zinc-800/50 transition-colors text-white">
                <span>Hat Julius eigentlich einen festen Musikgeschmack?</span>
                <span className="transition group-open:rotate-180">
                  <ArrowDown className="w-5 h-5 text-zinc-500" />
                </span>
              </summary>
              <div className="p-6 pt-0 text-zinc-400 leading-relaxed border-t border-zinc-800/50 mt-2 pt-4">
                Nein. Er spielt alles, was man theoretisch in Traktor laden kann. Schranz, D&B, Hardtekk oder 90er Eurodance – du weißt nie, was als nächstes droppt. Es ist wie russisches Roulette für die Ohren.
              </div>
            </details>
            
            <details className="group border border-zinc-800/80 bg-zinc-900/40 rounded-2xl overflow-hidden [&_summary::-webkit-details-marker]:hidden">
              <summary className="flex items-center justify-between p-6 cursor-pointer font-bold text-lg hover:bg-zinc-800/50 transition-colors text-white">
                <span>Gibt es ein Speicherlimit in der Cloud?</span>
                <span className="transition group-open:rotate-180">
                  <ArrowDown className="w-5 h-5 text-zinc-500" />
                </span>
              </summary>
              <div className="p-6 pt-0 text-zinc-400 leading-relaxed border-t border-zinc-800/50 mt-2 pt-4">
                Das Limit ist exakt dann erreicht, wenn Toms privates NAS im Wohnzimmer abraucht. Wir empfehlen daher, ausschließlich echte Banger hochzuladen.
              </div>
            </details>
          </div>
        </div>
      </section>

      {/* BEHIND THE SCENES / CALL TO ACTION */}
      <section className="relative z-10 py-32 px-6 bg-black border-t border-zinc-900">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            
            {/* Image Side */}
            <div className="relative group rounded-[2rem] overflow-hidden border border-zinc-800/50 shadow-2xl order-2 lg:order-1">
              <div className="absolute inset-0 bg-zinc-900/20 group-hover:bg-transparent transition-colors z-10 duration-500"></div>
              <Image 
                src="/images/team/Teamsfoto_busy.jpeg" 
                alt="Behind the scenes" 
                width={800} 
                height={1000} 
                className="w-full h-auto object-cover aspect-[3/4] md:aspect-square lg:aspect-[3/4] group-hover:scale-105 transition-all duration-1000" 
                unoptimized 
              />
            </div>

            {/* Text Side */}
            <div className="flex flex-col gap-6 items-start order-1 lg:order-2">
              <h2 className="text-4xl md:text-6xl font-black tracking-tight leading-tight text-white">
                Work Hard, <br /><span className="text-zinc-500">Play Harder.</span>
              </h2>
              <p className="text-zinc-400 text-lg leading-relaxed">
                Ready to join the session? Upload your tracks, sync your metadata, and collaborate with the crew in real-time. Experience the next generation of professional audio vaulting.
              </p>
              <div className="pt-4">
                <Link href="/login" className="inline-block">
                  <Button 
                    className="bg-white hover:bg-zinc-200 text-black h-16 px-10 rounded-full text-lg font-bold tracking-wider uppercase transition-all shadow-[0_0_40px_-10px_rgba(255,255,255,0.2)] hover:shadow-[0_0_60px_-15px_rgba(255,255,255,0.4)] active:scale-95"
                  >
                    Go to Shared Library
                    <ArrowRight className="w-5 h-5 ml-3 group-hover:translate-x-2 transition-transform" />
                  </Button>
                </Link>
              </div>
            </div>
            
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
