"use client";

import React from "react";
import { Sidebar } from "@/components/layout/sidebar";
import { LibraryView } from "@/components/views/library-view";

export default function LibraryPage() {
  return (
    <div className="flex flex-1 overflow-hidden bg-black text-zinc-300 font-sans selection:bg-zinc-800 animate-in fade-in duration-500">
      <Sidebar />
      <LibraryView />
    </div>
  );
}
