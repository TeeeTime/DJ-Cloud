"use client";

import React from "react";

interface SelectionActionBarProps {
  selectedCount: number;
  onSelectAll: () => void;
  children: React.ReactNode;
}

/** Bulk-action bar shown above the track list once select mode is on. */
export function SelectionActionBar({ selectedCount, onSelectAll, children }: SelectionActionBarProps) {
  return (
    <div className="mb-6 flex items-center flex-wrap gap-3 bg-zinc-900/30 border border-zinc-800 rounded-lg px-4 py-2.5">
      <span className="text-sm text-zinc-400">{selectedCount} selected</span>
      <button onClick={onSelectAll} className="text-sm text-zinc-400 hover:text-white transition-colors cursor-pointer">
        Select All
      </button>
      <div className="w-px h-4 bg-zinc-800" />
      <div className="flex items-center flex-wrap gap-2">
        {children}
      </div>
    </div>
  );
}
