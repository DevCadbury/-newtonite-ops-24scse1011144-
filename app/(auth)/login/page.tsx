"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Zap, Eye, EyeOff, LogIn } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

const DEMO_ACCOUNTS = [
  { email: "alice.ops@newtonite.dev",   role: "Ops · Lead",          label: "Alice" },
  { email: "bob.ops@newtonite.dev",     role: "Ops · Member",        label: "Bob" },
  { email: "carol.ops@newtonite.dev",   role: "Ops · Viewer",        label: "Carol" },
  { email: "dan.pay@newtonite.dev",     role: "Payments · Lead",     label: "Dan" },
  { email: "grace.comp@newtonite.dev",  role: "Compliance · Admin",  label: "Grace" },
  { email: "jack.eng@newtonite.dev",    role: "Engineering · Admin", label: "Jack" },
];

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail]     = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw]   = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Invalid credentials");
        return;
      }
      router.push("/");
      router.refresh();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm space-y-5">
        {/* Brand */}
        <div className="flex items-center justify-center gap-3 mb-2">
          <div className="flex size-10 items-center justify-center rounded-xl bg-primary">
            <Zap className="size-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-lg font-semibold tracking-tight">Newtonite Ops</h1>
            <p className="text-xs text-muted-foreground">Operations Tracker</p>
          </div>
        </div>

        {/* Login form */}
        <Card className="border-border/60 bg-card">
          <CardHeader className="pb-4">
            <CardTitle className="text-base font-medium">Sign in</CardTitle>
            <CardDescription className="text-xs">
              Enter your credentials to access the tracker
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-3.5">
              <div className="space-y-1.5">
                <Label htmlFor="email" className="text-xs font-medium">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@newtonite.dev"
                  autoComplete="email"
                  required
                  className="h-9 text-sm bg-muted/30 border-border/60 focus:border-primary/60"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="password" className="text-xs font-medium">Password</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPw ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="password123"
                    autoComplete="current-password"
                    required
                    className="h-9 text-sm pr-9 bg-muted/30 border-border/60 focus:border-primary/60"
                  />
                  <button
                    type="button"
                    tabIndex={-1}
                    aria-label={showPw ? "Hide password" : "Show password"}
                    onClick={() => setShowPw((s) => !s)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showPw ? (
                      <EyeOff className="size-3.5" />
                    ) : (
                      <Eye className="size-3.5" />
                    )}
                  </button>
                </div>
              </div>
              <Button
                type="submit"
                className="w-full h-9 text-sm gap-2 mt-1"
                disabled={loading}
              >
                <LogIn className="size-3.5" />
                {loading ? "Signing in…" : "Sign in"}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Demo accounts */}
        <Card className="border-border/60 bg-card">
          <CardHeader className="pb-2 pt-4">
            <CardTitle className="text-xs font-medium text-muted-foreground">
              Demo accounts · password: <code className="font-mono">password123</code>
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0 pb-4">
            <Separator className="mb-3" />
            <div className="grid grid-cols-2 gap-1.5">
              {DEMO_ACCOUNTS.map((acc) => (
                <button
                  key={acc.email}
                  type="button"
                  onClick={() => { setEmail(acc.email); setPassword("password123"); }}
                  className="text-left rounded-md border border-border/50 bg-muted/20 px-2.5 py-2 hover:bg-accent/60 hover:border-border transition-colors"
                >
                  <p className="text-xs font-medium">{acc.label}</p>
                  <p className="text-[10px] text-muted-foreground">{acc.role}</p>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
