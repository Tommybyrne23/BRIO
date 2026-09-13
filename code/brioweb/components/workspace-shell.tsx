"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { SignOutButton } from "@/components/sign-out-button";

export type ShellUser = { name: string; email: string; role: string };

const areas = [
  { name: "Today", path: "/dashboard", guestPath: "/demo", icon: "today" },
  { name: "Training", path: "/training", guestPath: "/demo/training", icon: "training" },
  { name: "Nutrition", path: "/nutrition", guestPath: "/demo/nutrition", icon: "nutrition" },
  { name: "Recovery", path: "/recovery", guestPath: "/demo/recovery", icon: "recovery" },
  { name: "Data", path: "/data", guestPath: "/demo/data", icon: "data" },
] as const;

function AreaIcon({ name }: { name: string }) {
  const paths: Record<string, React.ReactNode> = {
    today: <><circle cx="12" cy="12" r="7"/><path d="M12 8v4l3 2"/></>,
    training: <><path d="M4 9v6M7 7v10M17 7v10M20 9v6M7 12h10"/></>,
    nutrition: <><path d="M12 21c4-3 7-7 7-12-4 0-7 2-7 6-1-4-4-6-8-6 0 5 3 9 8 12Z"/><path d="M12 15V5"/></>,
    recovery: <><path d="M4 14c2-6 5-8 8-8s6 2 8 8"/><path d="M5 17h14M8 20h8"/></>,
    data: <><path d="M5 19V9M12 19V5M19 19v-7"/><path d="M3 19h18"/></>,
  };
  return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{paths[name]}</svg>;
}

export function WorkspaceShell({
  children,
  user,
  guest = false,
}: {
  children: React.ReactNode;
  user?: ShellUser;
  guest?: boolean;
}) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const close = (event: PointerEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) setMenuOpen(false);
    };
    const key = (event: KeyboardEvent) => event.key === "Escape" && setMenuOpen(false);
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", key);
    };
  }, [menuOpen]);

  return (
    <div className="brio-app-shell">
      <a className="skip-link" href="#main-content">Skip to content</a>
      <aside className="brio-rail" aria-label="Primary navigation">
        <Link href={guest ? "/demo" : "/dashboard"} className="brio-brand" aria-label="Brio home">
          <Image src="/brio-lockup.svg" alt="Brio" width={142} height={48} priority />
        </Link>
        <nav className="brio-rail-nav">
          {areas.map((area) => {
            const href = guest ? area.guestPath : area.path;
            const active = href === (guest ? "/demo" : "/dashboard") ? pathname === href : pathname.startsWith(href);
            return <Link key={area.name} href={href} className={active ? "brio-nav-link active" : "brio-nav-link"} aria-current={active ? "page" : undefined}>
              <AreaIcon name={area.icon} /><span>{area.name}</span>
            </Link>;
          })}
        </nav>
        <div className="brio-rail-foot">
          <Link className="brio-ask-link" href={guest ? "/demo/ask" : "/dashboard/chat"}><span aria-hidden="true">＋</span> Ask Brio</Link>
          {guest ? (
            <div className="brio-guest-actions"><span className="eyebrow">Guest workspace</span><Link href="/sign-up" className="button button-small">Create account</Link><Link href="/" className="text-link">Exit demo</Link></div>
          ) : user ? (
            <div ref={menuRef} className="brio-account-wrap">
              <button className="brio-account" onClick={() => setMenuOpen((value) => !value)} aria-expanded={menuOpen} aria-haspopup="menu"><span className="brio-avatar">{user.name.trim().charAt(0).toUpperCase() || "B"}</span><span><strong>{user.name}</strong><small>{user.email}</small></span></button>
              {menuOpen && <div className="brio-account-menu" role="menu"><Link href="/profile" onClick={() => setMenuOpen(false)}>Profile</Link>{user.role === "admin" && <Link href="/admin" onClick={() => setMenuOpen(false)}>Admin</Link>}<SignOutButton variant="menu-item" /></div>}
            </div>
          ) : null}
        </div>
      </aside>
      <main id="main-content" className="brio-main" tabIndex={-1}>{children}</main>
      <nav className="brio-bottom-nav" aria-label="Primary navigation">
        {areas.map((area) => {
          const href = guest ? area.guestPath : area.path;
          const active = href === (guest ? "/demo" : "/dashboard") ? pathname === href : pathname.startsWith(href);
          return <Link key={area.name} href={href} className={active ? "active" : ""} aria-current={active ? "page" : undefined}><AreaIcon name={area.icon}/><span>{area.name}</span></Link>;
        })}
      </nav>
    </div>
  );
}
