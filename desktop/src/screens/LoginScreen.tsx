import { useState, type FormEvent } from "react";
import { KeyRound, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface LoginScreenProps {
  onLogin: () => void;
}

export function LoginScreen({ onLogin }: LoginScreenProps) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    onLogin();
  }

  return (
    <div className="flex h-full flex-col items-center justify-center bg-black px-8 text-white">
      <div className="flex w-full flex-col items-center text-center">
        <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl border border-zinc-800 bg-zinc-900/80 shadow-inner">
          <KeyRound className="h-6 w-6 text-zinc-300" />
        </div>
        <h1 className="mb-1 text-xl font-black tracking-tight">DJ CLOUD</h1>
        <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">
          Login
        </p>
      </div>

      <form onSubmit={handleSubmit} className="mt-8 w-full space-y-3">
        <div className="relative">
          <User className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
          <Input
            type="text"
            placeholder="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="h-11 rounded-xl border-zinc-800 bg-black/60 pl-9 text-white placeholder:text-zinc-600 focus-visible:border-zinc-600 focus-visible:ring-zinc-600"
          />
        </div>
        <div className="relative">
          <KeyRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
          <Input
            type="password"
            placeholder="Passcode"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="h-11 rounded-xl border-zinc-800 bg-black/60 pl-9 text-white placeholder:text-zinc-600 focus-visible:border-zinc-600 focus-visible:ring-zinc-600"
          />
        </div>

        <Button
          type="submit"
          className="h-11 w-full rounded-xl bg-white font-bold uppercase tracking-widest text-black hover:bg-zinc-200"
        >
          Enter Archive
        </Button>
      </form>
    </div>
  );
}
