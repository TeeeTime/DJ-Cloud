"use client";

import React, { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, CheckCircle2, KeyRound, User, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AuroraText } from "@/components/ui/aurora-text";
import { useAuth } from "@/components/providers/auth-provider";
import { ApiError, authApi } from "@/lib/api";

function buildDesktopRedirectUrl(token: string, username: string) {
  return `djcloud://auth?token=${encodeURIComponent(token)}&username=${encodeURIComponent(username)}`;
}

function LoginPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isDesktop = searchParams.get("desktop") === "1";

  const { user, token, isLoading: isSessionLoading, login } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [manualRedirect, setManualRedirect] = useState(false);
  const [handedOff, setHandedOff] = useState(false);
  const hasAutoRedirected = useRef(false);

  // Navigating to a custom-scheme URL doesn't unload this tab the way a normal redirect would —
  // the OS hands off to the desktop app, but the browser tab itself just sits here afterward.
  // window.close() only works on a tab script itself opened (blocked by every modern browser for
  // a tab the user/OS opened, like this one), so it's attempted as a harmless best effort and
  // "you can close this window" is shown either way once enough time has passed for the OS to
  // have acted on the redirect. setHandedOff only ever runs inside this callback, never directly
  // in the effect below, so it can't trigger the cascading-render issue synchronous setState
  // calls in an effect body cause.
  const redirectToDesktop = useCallback((url: string) => {
    window.location.href = url;
    window.setTimeout(() => {
      window.close();
      setHandedOff(true);
    }, 1200);
  }, []);

  // A valid session already in localStorage means there's no reason to show the credentials
  // form at all — for the desktop handoff this makes "Log In" a single click whenever the
  // user's browser is already signed in to the website. Whether this is currently redirecting
  // is derived below (isAutoRedirecting) rather than tracked in state set from this effect.
  useEffect(() => {
    if (isSessionLoading || !user || !token) return;

    if (!isDesktop) {
      router.replace("/library");
      return;
    }

    if (hasAutoRedirected.current) return;
    hasAutoRedirected.current = true;
    redirectToDesktop(buildDesktopRedirectUrl(token, user.username));
  }, [isSessionLoading, user, token, isDesktop, router, redirectToDesktop]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      if (isDesktop) {
        // Deliberately bypasses the context's login() (which is for the browser's own
        // localStorage session and doesn't return the token) — this is a one-time handoff to
        // the desktop app, not a new browser session.
        const res = await authApi.login(username, password);
        setManualRedirect(true);
        redirectToDesktop(buildDesktopRedirectUrl(res.token, res.username));
        return;
      }

      await login(username, password);
      router.push("/library");
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.status === 401 ? "Invalid username or password" : err.message);
      } else {
        setError("Something went wrong. Please try again.");
      }
      setIsSubmitting(false);
    }
  };

  const alreadyAuthenticated = !isSessionLoading && !!user && !!token;
  const isAutoRedirecting = alreadyAuthenticated && isDesktop;
  const isRedirecting = manualRedirect || isAutoRedirecting;

  if (isSessionLoading || isRedirecting || alreadyAuthenticated) {
    return (
      <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center gap-4">
        {isRedirecting && handedOff ? (
          <>
            <div className="w-12 h-12 rounded-full bg-zinc-900/80 border border-zinc-800 flex items-center justify-center">
              <CheckCircle2 className="w-6 h-6 text-zinc-300" />
            </div>
            <p className="text-sm text-zinc-400">You are logged in — you can close this window now.</p>
          </>
        ) : (
          <>
            <Loader2 className="w-6 h-6 animate-spin text-zinc-400" />
            {isRedirecting && <p className="text-sm text-zinc-500">Redirecting to DJ Cloud Desktop…</p>}
          </>
        )}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center relative overflow-hidden font-sans selection:bg-zinc-800">
      {/* Dynamic Background Glow */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-zinc-900/30 via-black to-black z-0 pointer-events-none" />

      {/* Back Button */}
      <div className="absolute top-8 left-8 z-20">
        <Link href="/">
          <Button variant="ghost" className="text-zinc-400 hover:text-white hover:bg-zinc-900/50 rounded-full h-10 px-4 text-sm font-medium transition-colors">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Home
          </Button>
        </Link>
      </div>

      {/* Glassmorphism Card */}
      <div className="relative z-10 w-full max-w-md p-8 md:p-12 bg-zinc-950/40 backdrop-blur-2xl border border-zinc-800/50 rounded-3xl shadow-[0_0_80px_-20px_rgba(0,0,0,1)] animate-in fade-in zoom-in-95 duration-700">
        <div className="flex flex-col items-center mb-10 text-center">
          <div className="w-16 h-16 rounded-2xl bg-zinc-900/80 border border-zinc-800 flex items-center justify-center mb-6 shadow-inner">
            <KeyRound className="w-8 h-8 text-zinc-300" />
          </div>
          <h1 className="text-3xl font-black tracking-tight mb-2">
            <AuroraText colors={["#ffffff", "#d4d4d8", "#52525b", "#ffffff"]}>DJ-CLOUD</AuroraText>
          </h1>
          <p className="text-sm font-medium text-zinc-500 tracking-wider uppercase">
            Login
          </p>
        </div>

        <form onSubmit={handleLogin} className="space-y-6">
          <div className="space-y-4">
            <div className="relative group">
              <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 group-focus-within:text-white transition-colors" />
              <Input
                type="text"
                placeholder="Username"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="pl-10 h-12 bg-black/60 border-zinc-800 text-white rounded-xl focus-visible:ring-1 focus-visible:ring-zinc-600 focus-visible:border-zinc-600 transition-all placeholder:text-zinc-600"
              />
            </div>
            <div className="relative group">
              <KeyRound className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 group-focus-within:text-white transition-colors" />
              <Input
                type="password"
                placeholder="Passcode"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="pl-10 h-12 bg-black/60 border-zinc-800 text-white rounded-xl focus-visible:ring-1 focus-visible:ring-zinc-600 focus-visible:border-zinc-600 transition-all placeholder:text-zinc-600"
              />
            </div>
          </div>

          {error && (
            <p className="text-sm text-red-400 text-center -mt-2" role="alert">
              {error}
            </p>
          )}

          <Button
            type="submit"
            disabled={isSubmitting}
            className="w-full h-12 bg-white hover:bg-zinc-200 text-black font-bold tracking-widest uppercase rounded-xl transition-all hover:shadow-[0_0_30px_-5px_rgba(255,255,255,0.3)] active:scale-[0.98] disabled:opacity-70 disabled:hover:shadow-none"
          >
            {isSubmitting ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              "Enter Archive"
            )}
          </Button>
        </form>

        <div className="mt-8 text-center space-y-3">
          <p className="text-[10px] text-zinc-600 uppercase tracking-widest font-bold">
            Authorized Personnel Only
          </p>
          <p className="text-xs text-zinc-500">
            Have an invite code?{" "}
            <Link href="/register" className="text-zinc-300 hover:text-white underline underline-offset-4 transition-colors">
              Register
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-black text-white flex items-center justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-zinc-400" />
        </div>
      }
    >
      <LoginPageContent />
    </Suspense>
  );
}
