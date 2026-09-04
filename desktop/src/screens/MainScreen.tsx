import { useState } from "react";
import { FolderCog, LogOut, RefreshCw, Settings } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type SyncStatus = "idle" | "syncing" | "synced";

interface MainScreenProps {
  targetFolder: string | null;
  onChangeFolder: () => void;
  onLogout: () => void;
}

export function MainScreen({
  targetFolder,
  onChangeFolder,
  onLogout,
}: MainScreenProps) {
  const [status, setStatus] = useState<SyncStatus>("idle");

  function handleSync() {
    setStatus("syncing");
    setTimeout(() => setStatus("synced"), 1500);
  }

  const statusLabel =
    status === "syncing" ? "Syncing…" : status === "synced" ? "Up to date" : "Idle";

  return (
    <div className="flex h-full flex-col bg-background">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <span
          className="truncate text-xs text-muted-foreground"
          title={targetFolder ?? undefined}
        >
          {targetFolder ?? "No folder selected"}
        </span>

        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <button className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground outline-none transition-colors hover:bg-muted hover:text-foreground data-[state=open]:bg-muted data-[state=open]:text-foreground">
                <Settings className="h-4 w-4" />
              </button>
            }
          />
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={onChangeFolder}>
              <FolderCog />
              Change target folder
            </DropdownMenuItem>
            <DropdownMenuItem variant="destructive" onClick={onLogout}>
              <LogOut />
              Logout
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6">
        <Button size="lg" onClick={handleSync} disabled={status === "syncing"}>
          <RefreshCw className={cn(status === "syncing" && "animate-spin")} />
          Sync
        </Button>
        <p className="text-sm text-muted-foreground">{statusLabel}</p>
      </div>
    </div>
  );
}
