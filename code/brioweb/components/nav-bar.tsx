"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { SignOutButton } from "@/components/sign-out-button";

type NavBarUser = {
  name: string;
  email: string;
  role: string;
};

export function NavBar({ user }: { user: NavBarUser }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;

    function handlePointerDown(event: PointerEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setMenuOpen(false);
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [menuOpen]);

  const initial = user.name.trim().charAt(0).toUpperCase() || "?";

  return (
    <header className="border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
      <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-6">
        <div className="flex items-center gap-6">
          <Link
            href="/dashboard"
            className="text-lg font-semibold tracking-tight text-zinc-950 dark:text-zinc-50"
          >
            BRIO
          </Link>
          <nav className="flex items-center gap-4 text-sm font-medium">
            <Link
              href="/dashboard"
              className="text-zinc-600 transition-colors hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-zinc-50"
            >
              Dashboard
            </Link>
            <Link
              href="/dashboard/chat"
              className="text-zinc-600 transition-colors hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-zinc-50"
            >
              Chat with Coach
            </Link>
            {user.role === "admin" && (
              <Link
                href="/admin"
                className="text-zinc-600 transition-colors hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-zinc-50"
              >
                Admin
              </Link>
            )}
          </nav>
        </div>

        <div ref={menuRef} className="relative">
          <button
            onClick={() => setMenuOpen((open) => !open)}
            aria-expanded={menuOpen}
            aria-haspopup="menu"
            className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-950 text-sm font-semibold text-zinc-50 transition-opacity hover:opacity-90 dark:bg-zinc-50 dark:text-zinc-950"
          >
            {initial}
          </button>

          {menuOpen && (
            <div
              role="menu"
              className="absolute right-0 mt-2 w-48 rounded-2xl border border-zinc-200 bg-white p-2 shadow-sm dark:border-zinc-800 dark:bg-zinc-950"
            >
              <p className="truncate px-3 py-2 text-xs text-zinc-500 dark:text-zinc-400">
                {user.email}
              </p>
              <Link
                href="/profile"
                onClick={() => setMenuOpen(false)}
                className="block rounded-lg px-3 py-2 text-sm font-medium text-zinc-950 hover:bg-zinc-100 dark:text-zinc-50 dark:hover:bg-zinc-900"
              >
                Profile
              </Link>
              <div className="mt-1 border-t border-zinc-200 pt-1 dark:border-zinc-800">
                <SignOutButton variant="menu-item" />
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
