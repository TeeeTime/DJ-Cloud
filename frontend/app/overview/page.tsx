"use client";

import React from "react";
import { Sidebar } from "@/components/layout/sidebar";
import { OverviewView } from "@/components/views/overview-view";
import { RequireAuth } from "@/components/providers/require-auth";

export default function OverviewPage() {
  return (
    <RequireAuth>
      <div className="flex flex-1 overflow-hidden bg-black text-zinc-300 font-sans selection:bg-zinc-800 animate-in fade-in duration-500">
        <Sidebar />
        <OverviewView />
      </div>
    </RequireAuth>
  );
}
