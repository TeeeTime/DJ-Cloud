"use client";

import React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

/** Canonical genre detail URL — mirrors sidebar.tsx's `/genre/${encodeURIComponent(name)}` pattern. */
export function genreHref(genre: string): string {
  return `/genre/${encodeURIComponent(genre)}`;
}

interface GenreLinksProps {
  genres: string[];
  /**
   * "inline" — comma-separated text links, for table cells.
   * "badge"  — pill buttons, for cards. Uses preventDefault/stopPropagation + router.push instead of
   *            a real <Link> because badges live inside an outer <Link> (nested <a> is invalid HTML).
   */
  variant?: "inline" | "badge";
  emptyFallback?: React.ReactNode;
}

export function GenreLinks({ genres, variant = "inline", emptyFallback = "—" }: GenreLinksProps) {
  const router = useRouter();

  if (genres.length === 0) {
    if (variant === "badge") return null;
    return <span className="block truncate">{emptyFallback}</span>;
  }

  if (variant === "badge") {
    return (
      <div className="flex flex-wrap gap-1.5">
        {genres.map(genre => (
          <button
            key={genre}
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              router.push(genreHref(genre));
            }}
            className="text-xs text-zinc-300 border border-zinc-700 bg-zinc-800 px-2 py-0.5 rounded-full hover:border-zinc-500 hover:text-white transition-colors cursor-pointer"
          >
            {genre}
          </button>
        ))}
      </div>
    );
  }

  return (
    <span className="block truncate" title={genres.join(", ")}>
      {genres.map((genre, i) => (
        <React.Fragment key={genre}>
          {i > 0 && ", "}
          <Link href={genreHref(genre)} className="hover:text-white hover:underline">
            {genre}
          </Link>
        </React.Fragment>
      ))}
    </span>
  );
}
