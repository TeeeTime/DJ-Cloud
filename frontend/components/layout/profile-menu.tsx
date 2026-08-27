"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { KeyRound, Ticket, Copy, Check, Loader2, AlertCircle, MoreHorizontal, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { useAuth } from "@/components/providers/auth-provider";
import { ApiError, authApi, Role } from "@/lib/api";

const ROLES: Role[] = ["USER", "EDITOR", "ADMIN"];

function ChangePasswordDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { token, logout } = useAuth();
  const router = useRouter();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const reset = () => {
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setError("New passwords don't match");
      return;
    }
    if (!token) return;
    setError(null);
    setIsSubmitting(true);
    try {
      await authApi.changePassword(token, currentPassword, newPassword);
      // Changing the password invalidates every token, including this device's — sign out locally too.
      await logout();
      router.push("/login");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong. Please try again.");
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => { onOpenChange(next); if (!next) reset(); }}>
      <DialogContent className="bg-zinc-950 border-zinc-900 text-white sm:max-w-md rounded-xl p-6">
        <DialogHeader className="mb-6">
          <DialogTitle className="text-xl font-semibold">Change Password</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-3">
              <label className="text-xs font-medium text-zinc-400 uppercase tracking-wider mb-1.5 block">Current Password</label>
              <Input
                type="password"
                required
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="bg-black border-zinc-800 h-11 rounded-lg focus-visible:ring-1 focus-visible:ring-zinc-700"
              />
          </div>
          <div className="space-y-3">
              <label className="text-xs font-medium text-zinc-400 uppercase tracking-wider mb-1.5 block">New Password</label>
              <Input
                type="password"
                required
                minLength={8}
                maxLength={100}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="bg-black border-zinc-800 h-11 rounded-lg focus-visible:ring-1 focus-visible:ring-zinc-700"
              />
          </div>
          <div className="space-y-3">
              <label className="text-xs font-medium text-zinc-400 uppercase tracking-wider mb-1.5 block">Confirm New Password</label>
              <Input
                type="password"
                required
                minLength={8}
                maxLength={100}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="bg-black border-zinc-800 h-11 rounded-lg focus-visible:ring-1 focus-visible:ring-zinc-700"
              />
          </div>
          {error && (
            <p className="text-sm text-red-400 flex items-center gap-2" role="alert">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {error}
            </p>
          )}
          <DialogFooter className="mt-4">
            <Button
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-white hover:bg-zinc-200 text-black rounded-xl h-12 text-sm font-bold tracking-widest uppercase disabled:opacity-50"
            >
              {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : "Update Password"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function GenerateCodeDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { token } = useAuth();
  const [role, setRole] = useState<Role>("USER");
  const [code, setCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [copied, setCopied] = useState(false);

  const reset = () => {
    setRole("USER");
    setCode(null);
    setError(null);
    setCopied(false);
  };

  const handleGenerate = async () => {
    if (!token) return;
    setError(null);
    setIsGenerating(true);
    try {
      const res = await authApi.generateRegistrationCode(token, role);
      setCode(res.code);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong. Please try again.");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopy = async () => {
    if (!code) return;
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <Dialog open={open} onOpenChange={(next) => { onOpenChange(next); if (!next) reset(); }}>
      <DialogContent className="bg-zinc-950 border-zinc-900 text-white sm:max-w-md rounded-xl p-6">
        <DialogHeader className="mb-6">
          <DialogTitle className="text-xl font-semibold">Generate Registration Code</DialogTitle>
        </DialogHeader>

        {!code ? (
          <div className="space-y-6">
            <div className="space-y-3">
              <label className="text-xs font-medium text-zinc-400 uppercase tracking-wider mb-1.5 block">Role</label>
              <div className="grid grid-cols-3 gap-2">
                {ROLES.map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setRole(r)}
                    className={`h-11 rounded-lg text-xs font-bold uppercase tracking-wider border transition-colors ${role === r ? 'bg-white text-black border-white' : 'bg-black border-zinc-800 text-zinc-400 hover:text-white hover:border-zinc-600'}`}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>
            {error && (
              <p className="text-sm text-red-400 flex items-center gap-2" role="alert">
                <AlertCircle className="w-4 h-4 shrink-0" />
                {error}
              </p>
            )}
            <Button
              onClick={handleGenerate}
              disabled={isGenerating}
              className="w-full bg-white hover:bg-zinc-200 text-black rounded-xl h-12 text-sm font-bold tracking-widest uppercase disabled:opacity-50 mt-2"
            >
              {isGenerating ? <Loader2 className="w-5 h-5 animate-spin" /> : "Generate Code"}
            </Button>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="space-y-3">
              <label className="text-xs font-medium text-zinc-400 uppercase tracking-wider mb-1.5 block">{role} Invite Code</label>
              <div className="flex gap-2">
                <Input
                  readOnly
                  value={code}
                  onFocus={(e) => e.target.select()}
                  className="bg-black border-zinc-800 h-11 rounded-lg font-mono text-sm focus-visible:ring-1 focus-visible:ring-zinc-700"
                />
                <Button
                  type="button"
                  variant="secondary"
                  onClick={handleCopy}
                  title="Copy to clipboard"
                  className="bg-zinc-900 hover:bg-zinc-800 text-white rounded-lg h-11 w-11 p-0 border border-zinc-800 shrink-0"
                >
                  {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                </Button>
              </div>
            </div>
            <Button
              type="button"
              onClick={() => onOpenChange(false)}
              variant="outline"
              className="w-full h-12 rounded-xl border-zinc-800 bg-zinc-900 hover:bg-zinc-800 text-white text-sm font-bold tracking-widest uppercase"
            >
              Close
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export function ProfileMenu() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const [changePasswordOpen, setChangePasswordOpen] = useState(false);
  const [generateCodeOpen, setGenerateCodeOpen] = useState(false);
  const isAdmin = user?.role === 'ADMIN';

  const handleLogout = async () => {
    await logout();
    router.push("/login");
  };

  return (
    <>
      <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-zinc-900/50 border border-zinc-800/50">
        <div className="relative flex h-2.5 w-2.5 shrink-0">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-zinc-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-zinc-300"></span>
        </div>
        <div className="flex flex-col min-w-0 flex-1">
          <span className="text-xs font-medium text-white truncate">{user?.username ?? "Guest"}</span>
          <span className="text-[10px] text-zinc-500">{user?.role ?? "Not signed in"}</span>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger render={
            <button className="flex items-center justify-center h-7 w-7 text-zinc-500 hover:text-white hover:bg-zinc-800/50 data-[state=open]:bg-zinc-800/50 data-[state=open]:text-white rounded-md transition-colors outline-none cursor-pointer shrink-0">
              <MoreHorizontal className="w-4 h-4" />
            </button>
          } />
          <DropdownMenuContent align="end" side="top" sideOffset={8} className="w-56 bg-zinc-950 border-zinc-800 text-zinc-300 rounded-lg p-1 shadow-2xl">
            <DropdownMenuItem
              onClick={() => setChangePasswordOpen(true)}
              className="focus:!bg-zinc-800 focus:!text-white hover:!bg-zinc-800 hover:!text-white cursor-pointer rounded-md py-2"
            >
              <KeyRound className="w-4 h-4 mr-2" /> <span className="text-sm">Change Password</span>
            </DropdownMenuItem>
            {isAdmin && (
              <DropdownMenuItem
                onClick={() => setGenerateCodeOpen(true)}
                className="focus:!bg-zinc-800 focus:!text-white hover:!bg-zinc-800 hover:!text-white cursor-pointer rounded-md py-2"
              >
                <Ticket className="w-4 h-4 mr-2" /> <span className="text-sm">Generate Registration Code</span>
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator className="bg-zinc-800 my-1" />
            <DropdownMenuItem
              onClick={handleLogout}
              className="focus:!bg-red-950/50 focus:!text-red-400 hover:!bg-red-950/50 hover:!text-red-400 text-red-500 cursor-pointer rounded-md py-2"
            >
              <LogOut className="w-4 h-4 mr-2" /> <span className="text-sm">Log out</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <ChangePasswordDialog open={changePasswordOpen} onOpenChange={setChangePasswordOpen} />
      {isAdmin && <GenerateCodeDialog open={generateCodeOpen} onOpenChange={setGenerateCodeOpen} />}
    </>
  );
}
