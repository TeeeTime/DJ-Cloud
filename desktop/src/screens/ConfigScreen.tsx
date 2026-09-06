import { useState } from "react";
import { Loader2 } from "lucide-react";
import { open } from "@tauri-apps/plugin-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { commands } from "@/lib/commands";

interface ConfigScreenProps {
  targetFolder: string | null;
  onSave: (folder: string) => void;
}

export function ConfigScreen({ targetFolder, onSave }: ConfigScreenProps) {
  const [folder, setFolder] = useState(targetFolder ?? "");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isMove = targetFolder != null && targetFolder !== folder;

  async function handleBrowse() {
    const selected = await open({ directory: true, multiple: false });
    if (typeof selected === "string") {
      setFolder(selected);
    }
  }

  async function handleContinue() {
    setIsSaving(true);
    setError(null);
    try {
      // If a folder was already set, the backend moves its existing contents to the new path
      // first — nothing gets left behind, and nothing needs to be re-downloaded.
      await commands.setLibraryFolder(folder);
      onSave(folder);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="flex h-full flex-col bg-background">
      <div className="border-b border-border px-4 py-3">
        <h2 className="text-sm font-semibold text-foreground">Library folder</h2>
        <p className="text-xs text-muted-foreground">
          Choose where synced tracks are stored
        </p>
      </div>

      <div className="flex flex-1 flex-col justify-center gap-3 px-4">
        <div className="flex items-center gap-2">
          <Input
            value={folder}
            onChange={(e) => setFolder(e.target.value)}
            placeholder="No folder selected"
            className="h-9 flex-1 text-xs"
          />
          <Button type="button" variant="outline" size="sm" onClick={handleBrowse}>
            Browse…
          </Button>
        </div>
        <Button
          size="sm"
          className="w-full"
          disabled={!folder || isSaving}
          onClick={handleContinue}
        >
          {isSaving ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              {isMove ? "Moving library…" : "Saving…"}
            </>
          ) : (
            "Continue"
          )}
        </Button>
        {error && (
          <p className="text-[10px] text-destructive" title={error}>
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
