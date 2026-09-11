"use client";

import { useEffect, useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { motion } from "motion/react";
import type { DesktopDownloadLinks } from "@/app/desktop-download/route";

export function DesktopDownloadCard() {
  const [links, setLinks] = useState<DesktopDownloadLinks | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    // Deliberately not under /api/ — this repo's nginx routes everything under /api/* to the
    // Spring Boot backend on a different port, which would swallow this Next.js Route Handler
    // entirely in production (it did: the backend returned its own 401 for the unmapped path).
    fetch("/desktop-download")
      .then((res) => res.json())
      .then((data: DesktopDownloadLinks) => {
        if (!cancelled) setLinks(data);
      })
      .catch((err) => {
        console.error("Failed to load desktop download links", err);
        if (!cancelled) setLinks({ version: null, windows: null, macos: null });
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.5, delay: 0.4 }}
      className="bg-zinc-950 border border-zinc-900 rounded-xl p-6 hover:border-zinc-800 transition-all duration-300 flex flex-col"
    >
      <div className="flex items-center justify-between mb-8">
        <h3 className="text-base font-semibold text-white">Desktop App</h3>
      </div>

      {loading ? (
        <div className="flex items-center justify-center">
          <Loader2 className="w-5 h-5 animate-spin text-zinc-600" />
        </div>
      ) : (
        <div className="flex flex-col space-y-3">
          <DownloadButton href={links?.windows ?? null} label="Download for Windows" />
          <DownloadButton href={links?.macos ?? null} label="Download for Mac" />
          {links?.version && (
            <p className="text-xs text-zinc-600 pt-1">{links.version}</p>
          )}
        </div>
      )}
    </motion.div>
  );
}

function DownloadButton({ href, label }: { href: string | null; label: string }) {
  if (!href) {
    return (
      <span className="flex items-center gap-2 text-sm text-zinc-600 border border-zinc-900 rounded-lg px-4 py-2 cursor-not-allowed">
        <Download className="w-4 h-4" />
        {label}
      </span>
    );
  }

  return (
    <a
      href={href}
      className="flex items-center gap-2 text-sm text-zinc-300 border border-zinc-800 rounded-lg px-4 py-2 hover:border-zinc-700 hover:text-white hover:bg-zinc-900 transition-colors"
    >
      <Download className="w-4 h-4" />
      {label}
    </a>
  );
}
