"use client";

import React from "react";
import { Sidebar } from "@/components/layout/sidebar";
import { PlaylistBrowserView } from "@/components/views/playlist-browser-view";
import { RequireAuth } from "@/components/providers/require-auth";

export default function PlaylistsPage() {
  return (
    <RequireAuth>
      <div className="flex flex-1 overflow-hidden bg-black text-zinc-300 font-sans selection:bg-zinc-800 animate-in fade-in duration-500">
        <Sidebar />
        <PlaylistBrowserView />
      </div>
    </RequireAuth>
  );
}
