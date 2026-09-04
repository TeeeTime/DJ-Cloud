import { useEffect, useState } from "react";
import { Download, FolderCog, LogOut, RefreshCw, Settings } from "lucide-react";
import { check, type Update } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { commands, onSyncProgress, type SyncProgressEvent } from "@/lib/commands";

type SyncStatus = "idle" | "syncing" | "synced" | "error";
type UpdateStatus = "idle" | "checking" | "up-to-date" | "available" | "downloading" | "error";

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
  const [progress, setProgress] = useState<SyncProgressEvent | null>(null);

  const [updateStatus, setUpdateStatus] = useState<UpdateStatus>("idle");
  const [updateInfo, setUpdateInfo] = useState<Update | null>(null);
  const [updateProgress, setUpdateProgress] = useState<{ downloaded: number; total: number | null }>({
    downloaded: 0,
    total: null,
  });

  useEffect(() => {
    const unlistenPromise = onSyncProgress((event) => {
      setProgress(event);
    });
    return () => {
      unlistenPromise.then((unlisten) => unlisten());
    };
  }, []);

  async function handleSync() {
    setStatus("syncing");
    setProgress(null);
    try {
      await commands.syncLibrary();
      setStatus("synced");
    } catch {
      setStatus("error");
    }
  }

  // Disabled in dev builds: the version dev builds report is a static placeholder (CI sets the
  // real one from the release tag right before packaging), so a real check here would almost
  // always find a genuine release and could try to install a production build over the dev app.
  async function handleCheckForUpdates() {
    setUpdateStatus("checking");
    try {
      const update = await check();
      if (update) {
        setUpdateInfo(update);
        setUpdateStatus("available");
      } else {
        setUpdateInfo(null);
        setUpdateStatus("up-to-date");
      }
    } catch {
      setUpdateStatus("error");
    }
  }

  async function handleInstallUpdate() {
    if (!updateInfo) return;

    setUpdateStatus("downloading");
    setUpdateProgress({ downloaded: 0, total: null });

    try {
      let downloaded = 0;
      await updateInfo.downloadAndInstall((event) => {
        if (event.event === "Started") {
          setUpdateProgress({ downloaded: 0, total: event.data.contentLength ?? null });
        } else if (event.event === "Progress") {
          downloaded += event.data.chunkLength;
          setUpdateProgress((prev) => ({ downloaded, total: prev.total }));
        }
      });
      // No-op on Windows: downloadAndInstall already exits the app there once the installer
      // launches. Actually performs the relaunch on macOS, which requires it explicitly.
      await relaunch();
    } catch {
      setUpdateStatus("error");
    }
  }

  const isSyncing = status === "syncing";
  const isDownloadingUpdate = updateStatus === "downloading";

  const syncPercent =
    progress && progress.filesTotal > 0
      ? Math.round((progress.filesCompleted / progress.filesTotal) * 100)
      : 0;
  const updatePercent =
    updateProgress.total != null && updateProgress.total > 0
      ? Math.round((updateProgress.downloaded / updateProgress.total) * 100)
      : 0;

  const showSyncBar = isSyncing && progress && progress.filesTotal > 0;
  const showUpdateBar = isDownloadingUpdate && updateProgress.total != null;

  const updateStatusLabel = (() => {
    if (updateStatus === "checking") return "Checking for updates…";
    if (updateStatus === "up-to-date") return "App is up to date";
    if (updateStatus === "available" && updateInfo) return `Update available: v${updateInfo.version}`;
    if (updateStatus === "downloading") return showUpdateBar ? `Downloading update… ${updatePercent}%` : "Downloading update…";
    if (updateStatus === "error") return "Update check failed";
    return null;
  })();

  const syncStatusLabel = (() => {
    if (status === "error") return "Sync failed";
    if (status === "synced") return "Up to date";
    if (!isSyncing) return "Idle";
    if (!progress || progress.filesTotal === 0) return "Checking library…";
    if (progress.phase === "done") return "Finishing…";
    return `${progress.currentFile ?? "…"} (${progress.filesCompleted}/${progress.filesTotal})`;
  })();

  // Update status takes priority over sync status when there's something to report — the two
  // share one status/progress area rather than each getting dedicated UI space.
  const statusLabel = updateStatusLabel ?? syncStatusLabel;
  const barPercent = showSyncBar ? syncPercent : showUpdateBar ? updatePercent : 0;

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
            <DropdownMenuItem
              onClick={handleCheckForUpdates}
              disabled={import.meta.env.DEV}
              title={import.meta.env.DEV ? "Not available in development" : undefined}
            >
              <Download />
              Check for Updates
            </DropdownMenuItem>
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

      <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6">
        <Button onClick={handleSync} disabled={isSyncing}>
          <RefreshCw className={cn(isSyncing && "animate-spin")} />
          Sync
        </Button>

        {updateStatus === "available" && (
          <Button variant="outline" size="sm" onClick={handleInstallUpdate}>
            Install v{updateInfo?.version}
          </Button>
        )}

        {(showSyncBar || showUpdateBar) && (
          <div className="h-1 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-[width]"
              style={{ width: `${barPercent}%` }}
            />
          </div>
        )}

        <p className="w-full truncate text-center text-xs text-muted-foreground" title={statusLabel}>
          {statusLabel}
        </p>
      </div>
    </div>
  );
}
