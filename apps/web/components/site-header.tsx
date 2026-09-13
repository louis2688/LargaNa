"use client";

import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { Bell, Menu, Moon, Sun, X } from "lucide-react";
import { Avatar, AvatarFallback } from "./ui/avatar";
import { Button } from "./ui/button";

function ThemeToggle() {
  const [theme, setTheme] = useState<"light" | "dark">("light");
  useEffect(() => { setTheme(document.documentElement.dataset.theme === "dark" ? "dark" : "light"); }, []);
  const toggle = () => {
    const next = theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    try { localStorage.setItem("theme", next); } catch {}
    setTheme(next);
  };
  return <Button variant="ghost" size="icon" aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"} aria-pressed={theme === "dark"} onClick={toggle}>{theme === "dark" ? <Sun size={19} /> : <Moon size={19} />}</Button>;
}

const initials = (session: Session) => {
  const name: string = session.user.user_metadata?.full_name ?? session.user.email ?? "?";
  return name.split(/[\s@]+/).filter(Boolean).slice(0, 2).map((word) => word[0]!.toUpperCase()).join("");
};

export function SiteHeader({ session, onSignIn, onSignOut }: { session: Session | null; onSignIn: () => void; onSignOut: () => void }) {
  const [menuOpen, setMenuOpen] = useState(false);
  return <header className="site-header">
    <a className="brand" href="/" aria-label="LargaNa home"><span>Larga</span>Na</a>
    <nav className="site-nav" id="primary-nav" data-open={menuOpen} aria-label="Primary navigation" onClick={() => setMenuOpen(false)}>
      <a href="/#rides">Book a ride</a><a href="/driver">Drive</a><a href="/#safety">Safety</a>
    </nav>
    <div className="header-controls">
      <ThemeToggle />
      {session ? <>
        <Button variant="ghost" size="icon" aria-label="Notifications"><Bell size={19} /></Button>
        <Button variant="ghost" size="icon" className="avatar-button" aria-label={`Sign out ${session.user.email ?? ""}`} title="Sign out" onClick={onSignOut}>
          <Avatar className="profile-avatar"><AvatarFallback>{initials(session)}</AvatarFallback></Avatar>
        </Button>
      </> : <Button variant="outline" size="sm" onClick={onSignIn}>Sign in</Button>}
      <Button variant="ghost" size="icon" className="menu-button" aria-label={menuOpen ? "Close menu" : "Open menu"} aria-expanded={menuOpen} aria-controls="primary-nav" onClick={() => setMenuOpen((open) => !open)}>{menuOpen ? <X size={20} /> : <Menu size={20} />}</Button>
    </div>
  </header>;
}
