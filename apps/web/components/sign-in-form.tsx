"use client";

import { useState } from "react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { supabase } from "../lib/supabase";

// ponytail: email + password for the demo accounts; phone OTP replaces this once an SMS provider exists.
export function SignInForm({ onDone, hint }: { onDone?: () => void; hint?: string }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) setError(error.message);
    else onDone?.();
  };

  return <form className="sign-in-form" onSubmit={submit}>
    <label>Email<Input type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></label>
    <label>Password<Input type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} /></label>
    {error && <p className="form-error" role="alert">{error}</p>}
    <Button type="submit" className="wide-button" disabled={busy}>{busy ? "Signing in…" : "Sign in"}</Button>
    {hint && <p className="form-hint">{hint}</p>}
  </form>;
}
