import { useState } from "react";
import { KeyRound, ExternalLink, Loader2 } from "lucide-react";
import { openUrl } from "@tauri-apps/plugin-opener";
import { Button } from "@/components/ui/button";

const WEB_LOGIN_URL =
  import.meta.env.VITE_WEB_LOGIN_URL ?? "http://localhost:3000/login?desktop=1";

export function LoginScreen() {
  const [isWaiting, setIsWaiting] = useState(false);

  async function handleLogin() {
    setIsWaiting(true);
    await openUrl(WEB_LOGIN_URL);
    // No further action here — App.tsx's "auth-token-received" listener (fed by the Rust-side
    // djcloud:// deep-link handler) is what actually advances past this screen.
  }

  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 bg-background px-8 text-foreground">
      <div className="flex flex-col items-center text-center">
        <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl border border-border bg-card shadow-inner">
          <KeyRound className="h-5 w-5 text-muted-foreground" />
        </div>
        <h1 className="text-lg font-black tracking-tight">DJ CLOUD</h1>
        <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
          Login Required
        </p>
      </div>

      <Button type="button" className="w-48" onClick={handleLogin} disabled={isWaiting}>
        {isWaiting ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <>
            <ExternalLink className="h-4 w-4" />
            Log In
          </>
        )}
      </Button>
      <p className="text-[10px] text-muted-foreground">
        {isWaiting ? "Waiting for browser login…" : "Opens in your browser"}
      </p>
    </div>
  );
}
