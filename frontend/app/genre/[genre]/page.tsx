"use client";

import React from "react";
import { useParams } from "next/navigation";
import { Sidebar } from "@/components/layout/sidebar";
import { GenreView } from "@/components/views/genre-view";
import { RequireAuth } from "@/components/providers/require-auth";

export default function GenrePage() {
  const params = useParams<{ genre: string }>();

  return (
    <RequireAuth>
      <div className="flex flex-1 overflow-hidden bg-black text-zinc-300 font-sans selection:bg-zinc-800 animate-in fade-in duration-500">
        <Sidebar />
        <GenreView genreName={decodeURIComponent(params.genre)} />
      </div>
    </RequireAuth>
  );
}
