"use client";

import { CheckSquare, X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface SelectionControlsProps {
  selectMode: boolean;
  totalCount: number;
  onEnter: () => void;
  onCancel: () => void;
}

/**
 * Icon-only toggle for the list's column-header bar (far right): enters select mode, or — once
 * active — cancels it (the "N selected · Select All" summary lives in `SelectionActionBar`
 * instead, since this cell is too narrow for that text).
 */
export function SelectionControls({ selectMode, totalCount, onEnter, onCancel }: SelectionControlsProps) {
  if (totalCount === 0 && !selectMode) return null;

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={selectMode ? onCancel : onEnter}
      title={selectMode ? "Cancel selection" : "Select tracks"}
      className="text-zinc-500 hover:text-white hover:bg-zinc-800/50"
    >
      {selectMode ? <X className="w-4 h-4" /> : <CheckSquare className="w-4 h-4" />}
    </Button>
  );
}
