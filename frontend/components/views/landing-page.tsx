"use client";

import React, { useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { ArrowRight, ArrowDown, CloudUpload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AuroraText } from "@/components/ui/aurora-text";
import { ScrollVelocityContainer, ScrollVelocityRow } from "@/components/ui/scroll-based-velocity";
import { AnimatedBeam } from "@/components/ui/animated-beam";
import { colorThemes } from "@/lib/data";
import { usePlayer } from "@/components/providers/player-provider";

const TEAM_MEMBERS = [
  {
    name: "Tom",
    role: "The Architect • Traktor Pro",
    image: "/images/team/Tom_Protait_Professionell.png",
    bio: "The mastermind who originally coded this platform. By day, he's a serious Java developer prioritizing his studies and keeping our servers alive. By night, he's a veteran on the decks dropping absolute bombs.",
    genres: ["Schranz (Main)", "Drum & Bass", "Tech House"],
  },
  {
    name: "Carlos",
    role: "The Busy Bee • DDJ 400",
    image: "/images/team/Carlos_Protait_Professionell.png",
    bio: "Always otherwise occupied and rarely gets around to actually DJing. But when the stars align and his DDJ-400 is dusted off, it's pure groove. He recently caught the heavy D&B bug directly from Tom.",
    genres: ["House Remixes", "Bounce & Trance", "Tech House"],
  },
  {
    name: "Julius",
    role: "The Wildcard • Traktor Pro",
    image: "/images/team/Julius_Protait_Professionell.png",
    bio: "The newest member to join the decks, but don't let that fool you. Armed with a solid Traktor setup, he's an absolute wildcard who will seamlessly mix literally anything that makes the crowd move.",
    genres: ["Drum & Bass", "Schranz", "Everything Else"],
  },
] as const;

const FAQ_ITEMS = [
  {
    question: "Can I upload Schlager too?",
    answer:
      "No. Anyone who uploads Schlager to the cloud gets their account permanently banned and their USB stick formatted. No discussion.",
  },
  {
    question: "Why is Carlos never actually seen behind the decks?",
    answer:
      "Carlos is chronically \u201Cotherwise occupied.\u201D On the rare occasion he does find time, he first has to dust off his DDJ-400 and install a Rekordbox update, which takes up the rest of the evening.",
  },
  {
    question: "What happens when Tom starts coding?",
    answer:
      "Servers crash, databases catch fire, but somehow it works out in the end. Spring Boot's got this.",
  },
  {
    question: "How many BPM does Tom need to wake up?",
    answer:
      "Anything under 150 BPM is basically ambient to Tom. His morning coffee gets stirred, appropriately, by some hard Schranz kicks.",
  },
  {
    question: "Does Julius actually have a main genre?",
    answer:
      "No. He plays anything that can theoretically be loaded into Traktor. Schranz, D&B, Hardtekk, or 90s Eurodance – you never know what drops next. It's Russian roulette for your ears.",
  },
  {
    question: "Is there a storage limit on the cloud?",
    answer:
      "The limit is reached exactly when Tom's personal VPS goes up in flames. So we recommend uploading nothing but certified bangers.",
  },
] as const;

function NetworkAnimation() {
  const containerRef = useRef<HTMLDivElement>(null);
  const tomRef = useRef<HTMLDivElement>(null);
  const carlosRef = useRef<HTMLDivElement>(null);
  const juliusRef = useRef<HTMLDivElement>(null);
  const vaultRef = useRef<HTMLDivElement>(null);

  const djNodes = [
    { name: "Tom", image: "/images/team/Tom_Protait_Professionell.png", ref: tomRef },
    { name: "Carlos", image: "/images/team/Carlos_Protait_Professionell.png", ref: carlosRef },
    { name: "Julius", image: "/images/team/Julius_Protait_Professionell.png", ref: juliusRef },
  ];

  return (
    <div
      ref={containerRef}
      className="relative flex w-full max-w-3xl items-center justify-between px-4 py-7 sm:px-10 sm:py-8 md:px-14 h-72 sm:h-80 mx-auto mb-14 md:mb-16 bg-zinc-900/30 rounded-[2rem] border border-zinc-800/70 backdrop-blur-sm shadow-[inset_0_1px_0_0_rgba(255,255,255,0.04)]"
    >
      {/* Left side: DJs */}
      <div className="flex flex-col justify-between h-full z-10">
        {djNodes.map((dj) => (
          <div key={dj.name} className="flex items-center gap-3 sm:gap-4 group cursor-pointer">
            <span className="w-14 sm:w-16 text-right text-[10px] sm:text-[11px] font-bold text-zinc-400 uppercase tracking-widest group-hover:text-white transition-colors select-none whitespace-nowrap">
              {dj.name}
            </span>
            <div
              ref={dj.ref}
              className="w-12 h-12 sm:w-14 sm:h-14 shrink-0 rounded-2xl bg-zinc-900 border-2 border-zinc-700 flex items-center justify-center overflow-hidden relative group-hover:border-white group-hover:shadow-[0_0_24px_-6px_rgba(255,255,255,0.4)] transition-all duration-300"
            >
              <Image
                src={dj.image}
                alt={dj.name}
                width={150}
                height={150}
                className="w-full h-full object-cover opacity-75 group-hover:opacity-100 transition-all duration-300 grayscale group-hover:grayscale-0 group-hover:scale-105"
                unoptimized
              />
            </div>
          </div>
        ))}
      </div>

      {/* Right side: Cloud Vault */}
      <div className="relative flex flex-col items-center z-10">
        <div
          ref={vaultRef}
          className="w-20 h-20 sm:w-24 sm:h-24 shrink-0 rounded-3xl bg-white text-black flex items-center justify-center shadow-[0_0_45px_-10px_rgba(255,255,255,0.5)]"
        >
          <CloudUpload className="w-8 h-8 sm:w-10 sm:h-10" />
        </div>
        <span className="absolute -bottom-6 text-[10px] font-bold uppercase tracking-widest text-zinc-500 whitespace-nowrap select-none">
          Vault
        </span>
      </div>

      {/* Beams */}
      <AnimatedBeam
        containerRef={containerRef}
        fromRef={tomRef}
        toRef={vaultRef}
        curvature={40}
        duration={3}
        gradientStartColor="#52525b"
        gradientStopColor="#ffffff"
        pathColor="#3f3f46"
        pathOpacity={0.35}
      />
      <AnimatedBeam
        containerRef={containerRef}
        fromRef={carlosRef}
        toRef={vaultRef}
        curvature={0}
        duration={4}
        delay={1}
        gradientStartColor="#52525b"
        gradientStopColor="#ffffff"
        pathColor="#3f3f46"
        pathOpacity={0.35}
      />
      <AnimatedBeam
        containerRef={containerRef}
        fromRef={juliusRef}
        toRef={vaultRef}
        curvature={-40}
        duration={3.5}
        delay={2}
        gradientStartColor="#52525b"
        gradientStopColor="#ffffff"
        pathColor="#3f3f46"
        pathOpacity={0.35}
      />
    </div>
  );
}

export function LandingPage() {
  const { setThemeIndex } = usePlayer();
  const scrollRef = useRef<HTMLDivElement>(null);
  const aboutRef = useRef<HTMLElement>(null);

  const handleScrollToAbout = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    aboutRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div
      ref={scrollRef}
      className="flex-1 flex flex-col overflow-y-auto overflow-x-hidden bg-black text-white selection:bg-zinc-800 selection:text-white font-sans animate-in fade-in duration-500 scroll-smooth no-scrollbar"
    >
      {/* HERO SECTION (Full Screen) */}
      <section className="relative min-h-dvh shrink-0 flex flex-col items-center justify-between overflow-hidden">
        {/* Background glow */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-zinc-900/35 via-black to-black z-0 pointer-events-none" />

        {/* Diagonal Scrolling Text Background */}
        <div
          aria-hidden="true"
          className="absolute inset-0 z-0 flex flex-col justify-center opacity-20 rotate-[-5deg] scale-110 pointer-events-none gap-6 md:gap-8"
        >
          <ScrollVelocityContainer>
            <ScrollVelocityRow
              className="text-6xl md:text-9xl font-black text-transparent tracking-tighter uppercase"
              style={{ WebkitTextStroke: "2px #52525b" }}
              baseVelocity={-1}
            >
              &nbsp;• HIGH QUALITY AUDIO • KEY ANALYSIS • LOSSLESS PLAYBACK
            </ScrollVelocityRow>
          </ScrollVelocityContainer>
          <ScrollVelocityContainer>
            <ScrollVelocityRow
              className="text-6xl md:text-9xl font-black text-zinc-800 tracking-tighter uppercase"
              baseVelocity={1.5}
            >
              &nbsp;• COLLABORATIVE LIBRARY • BPM DETECTION • MP3 • WAV
            </ScrollVelocityRow>
          </ScrollVelocityContainer>
          <ScrollVelocityContainer>
            <ScrollVelocityRow
              className="text-6xl md:text-9xl font-black text-transparent tracking-tighter uppercase"
              style={{ WebkitTextStroke: "2px #52525b" }}
              baseVelocity={-1.2}
            >
              &nbsp;• CLOUD SYNC • METADATA EDITOR • PRO DJ TOOLS
            </ScrollVelocityRow>
          </ScrollVelocityContainer>
        </div>

        {/* Subtle Edge & Center Contrast Vignette */}
        <div
          aria-hidden="true"
          className="absolute inset-0 z-0 pointer-events-none bg-[radial-gradient(ellipse_at_center,rgba(0,0,0,0.45)_0%,rgba(0,0,0,0.1)_55%,rgba(0,0,0,0.92)_100%)]"
        />

        {/* Foreground Content */}
        <div className="relative z-10 flex flex-col items-center justify-center flex-1 w-full px-6 pt-16 pb-6 md:pt-20 md:pb-8">
          <div className="flex flex-col items-center text-center max-w-4xl animate-in fade-in zoom-in-95 duration-1000">
            <h1 className="text-5xl sm:text-7xl md:text-[8rem] font-black tracking-tighter leading-none mb-5 md:mb-6">
              <AuroraText className="pl-2" colors={["#ffffff", "#d4d4d8", "#52525b", "#ffffff"]}>
                DJ-CLOUD
              </AuroraText>
            </h1>

            <p className="text-zinc-400 text-sm sm:text-base md:text-xl font-medium tracking-[0.14em] sm:tracking-[0.2em] uppercase mb-9 md:mb-12 max-w-2xl leading-relaxed">
              The next-generation collaborative library for professional audio and playlists.
            </p>

            <div>
              <Link href="/login" className="inline-block">
                <Button className="group cursor-pointer bg-white hover:bg-zinc-200 text-black h-12 px-7 text-sm sm:h-14 sm:px-8 sm:text-base md:h-16 md:px-10 md:text-lg rounded-full font-bold tracking-wider uppercase transition-all shadow-[0_0_40px_-10px_rgba(255,255,255,0.25)] hover:shadow-[0_0_60px_-15px_rgba(255,255,255,0.45)] active:scale-95">
                  Access Archive
                  <ArrowRight className="size-4 md:size-5 ml-2.5 md:ml-3 group-hover:translate-x-2 transition-transform" />
                </Button>
              </Link>
            </div>
          </div>
        </div>

        {/* Scroll Indicator */}
        <a
          href="#about"
          onClick={handleScrollToAbout}
          aria-label="Scroll to Our Story"
          className="relative z-10 mb-6 md:mb-10 px-4 py-2 rounded-full flex flex-col items-center text-zinc-500 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-500 transition-colors cursor-pointer group"
        >
          <span className="text-[10px] uppercase tracking-widest font-bold mb-2">Our Story</span>
          <ArrowDown className="w-4 h-4 animate-bounce" />
        </a>
      </section>

      {/* ABOUT US SECTION */}
      <section
        id="about"
        ref={aboutRef}
        className="relative z-10 py-20 md:py-32 px-6 bg-black border-t border-zinc-900"
      >
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">
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
              <div className="text-zinc-400 text-base sm:text-lg leading-relaxed space-y-5 sm:space-y-6">
                <p>
                  We are a passionate team of three Information Systems students from the University of Münster. What started as late-night coding sessions and a shared love for electronic music quickly evolved into a mission.
                </p>
                <p>
                  Frustrated by the limitations of existing DJ platforms and cloud storage solutions, we decided to build our own. DJ-CLOUD is our vision of the perfect collaborative library — engineered with German precision, designed for professional audio, and built to withstand the heaviest drops.
                </p>
              </div>
              <div className="pt-6 border-t border-zinc-900 flex flex-wrap gap-x-10 gap-y-5">
                <div>
                  <p className="text-2xl sm:text-3xl font-black text-white tracking-tight">2026</p>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 mt-1">Founded</p>
                </div>
                <div>
                  <p className="text-2xl sm:text-3xl font-black text-white tracking-tight">Uni Münster</p>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 mt-1">Roots</p>
                </div>
                <div>
                  <p className="text-2xl sm:text-3xl font-black text-white tracking-tight">100%</p>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 mt-1">Lossless</p>
                </div>
              </div>
            </div>

            {/* Image Side */}
            <div className="relative group rounded-[2rem] overflow-hidden border border-zinc-800/70 hover:border-zinc-700/80 transition-colors shadow-2xl animate-in fade-in slide-in-from-right-8 duration-1000">
              <div className="absolute inset-0 bg-zinc-900/20 group-hover:bg-transparent transition-colors z-10 duration-500 pointer-events-none" />
              <Image
                src="/images/team/Team_Backstage.png"
                alt="Tom, Carlos and Julius"
                width={800}
                height={600}
                className="w-full h-auto object-cover aspect-[4/3] grayscale-[30%] group-hover:grayscale-0 group-hover:scale-105 transition-all duration-1000"
                unoptimized
              />
            </div>
          </div>
        </div>
      </section>

      {/* MEET THE COLLECTIVE & ANIMATION SECTION */}
      <section className="relative z-10 py-20 md:py-32 px-6 bg-black border-t border-zinc-900">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12 md:mb-14">
            <h2 className="text-4xl md:text-6xl font-black tracking-tight mb-5 md:mb-6">
              Synced to the <span className="text-zinc-500">Vault.</span>
            </h2>
            <p className="text-zinc-400 text-base sm:text-lg md:text-xl max-w-2xl mx-auto">
              Direct uploads from our setups to a unified, lossless archive.
            </p>
          </div>

          {/* Network Upload Animation */}
          <NetworkAnimation />

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8 mt-16 md:mt-20">
            {TEAM_MEMBERS.map((member) => (
              <div
                key={member.name}
                className="flex flex-col bg-zinc-900/40 border border-zinc-800/80 rounded-3xl p-7 lg:p-8 hover:bg-zinc-900/80 transition-all duration-300 group relative overflow-hidden hover:-translate-y-2 hover:shadow-[0_24px_50px_-20px_rgba(0,0,0,0.9)] hover:border-zinc-600/80"
              >
                <div className="w-16 h-16 rounded-2xl bg-zinc-800 flex items-center justify-center mb-6 overflow-hidden border border-zinc-700 group-hover:border-zinc-500 shadow-lg group-hover:scale-105 transition-all duration-300">
                  <Image
                    src={member.image}
                    alt={member.name}
                    width={64}
                    height={64}
                    className="w-full h-full object-cover"
                    unoptimized
                  />
                </div>
                <h3 className="text-2xl font-bold mb-1">{member.name}</h3>
                <p className="text-[10px] text-zinc-500 font-bold tracking-widest uppercase mb-4">
                  {member.role}
                </p>
                <p className="text-zinc-400 text-sm leading-relaxed mb-6">
                  {member.bio}
                </p>
                <div className="flex flex-wrap gap-2 mt-auto pt-2">
                  {member.genres.map((genre) => (
                    <span
                      key={genre}
                      className="text-[11px] font-semibold bg-black/80 border border-zinc-800 group-hover:border-zinc-700 px-2.5 py-1 rounded-md text-zinc-300 transition-colors"
                    >
                      {genre}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FREQUENTLY ASKED QUESTIONS */}
      <section className="relative z-10 py-20 md:py-32 px-6 bg-black border-t border-zinc-900">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12 md:mb-16">
            <h2 className="text-4xl md:text-5xl font-black tracking-tight mb-4 text-white">
              Frequently Asked <span className="text-zinc-500">Questions</span>
            </h2>
            <p className="text-zinc-400 text-base sm:text-lg">
              Very serious answers to very serious questions.
            </p>
          </div>

          <div className="space-y-3.5 sm:space-y-4">
            {FAQ_ITEMS.map((item) => (
              <details
                key={item.question}
                className="group border border-zinc-800/80 bg-zinc-900/40 hover:border-zinc-700/80 open:border-zinc-700 open:bg-zinc-900/60 rounded-2xl overflow-hidden transition-colors [&_summary::-webkit-details-marker]:hidden"
              >
                <summary className="flex items-center justify-between gap-4 px-5 py-5 sm:p-6 cursor-pointer font-bold text-base sm:text-lg hover:bg-zinc-800/40 transition-colors text-white select-none list-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-zinc-500">
                  <span>{item.question}</span>
                  <span className="shrink-0 transition-transform duration-200 group-open:rotate-180 text-zinc-500 group-hover:text-zinc-300 group-open:text-white">
                    <ArrowDown className="w-5 h-5" />
                  </span>
                </summary>
                <div className="px-5 sm:px-6 py-4 sm:py-5 text-sm sm:text-base text-zinc-400 leading-relaxed border-t border-zinc-800/60 bg-black/25">
                  {item.answer}
                </div>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* BEHIND THE SCENES / CALL TO ACTION */}
      <section className="relative z-10 py-20 md:py-32 px-6 bg-black border-t border-zinc-900">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">
            {/* Image Side */}
            <div className="relative group rounded-[2rem] overflow-hidden border border-zinc-800/70 hover:border-zinc-700/80 transition-colors shadow-2xl order-2 lg:order-1">
              <div className="absolute inset-0 bg-zinc-900/20 group-hover:bg-transparent transition-colors z-10 duration-500 pointer-events-none" />
              <Image
                src="/images/team/Teamsfoto_busy.png"
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
                Work Hard, <br />
                <span className="text-zinc-500">Play Harder.</span>
              </h2>
              <p className="text-zinc-400 text-base sm:text-lg leading-relaxed">
                Ready to join the session? Upload your tracks, sync your metadata, and collaborate with the crew in real-time. Experience the next generation of professional audio vaulting.
              </p>
              <div className="pt-2 md:pt-4">
                <Link href="/login" className="inline-block max-w-full">
                  <Button className="group cursor-pointer bg-white hover:bg-zinc-200 text-black h-12 px-6 text-sm sm:h-14 sm:px-8 sm:text-base md:h-16 md:px-10 md:text-lg rounded-full font-bold tracking-wider uppercase transition-all shadow-[0_0_40px_-10px_rgba(255,255,255,0.25)] hover:shadow-[0_0_60px_-15px_rgba(255,255,255,0.45)] active:scale-95 max-w-full">
                    Go to Shared Library
                    <ArrowRight className="size-4 md:size-5 ml-2.5 md:ml-3 group-hover:translate-x-2 transition-transform" />
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-5 px-6 md:px-8 border-t border-zinc-900 text-[10px] text-zinc-500 uppercase tracking-widest font-bold bg-black relative z-10">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-2 text-center">
          <span>DJ-CLOUD © 2026</span>
          {/* Hidden Theme Switcher Trigger */}
          <span
            className="cursor-crosshair hover:text-zinc-300 transition-colors select-none"
            onClick={() => setThemeIndex((prev) => (prev + 1) % colorThemes.length)}
          >
            v{process.env.NEXT_PUBLIC_APP_VERSION}
          </span>
        </div>
      </footer>
    </div>
  );
}
