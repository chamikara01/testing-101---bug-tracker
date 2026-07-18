"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Logo } from "@/components/brand/logo";
import { SignOutButton } from "@/components/sign-out-button";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/", label: "Dashboard" },
  { href: "/projects", label: "Projects" },
];

export function AppHeader({ email }: { email: string }) {
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 4);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={cn(
        "sticky top-0 z-30 border-b border-black/20 bg-brand-nav transition-shadow duration-200",
        scrolled && "shadow-[0_6px_20px_rgba(15,23,42,0.28)]",
      )}
    >
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <div className="flex items-center gap-3 sm:gap-6">
          <Link href="/" className="shrink-0" aria-label="Testing 101 home">
            <Logo tone="dark" withWordmark={false} className="sm:hidden" />
            <Logo tone="dark" className="hidden sm:inline-flex" />
          </Link>
          <nav className="flex items-center gap-0.5 sm:gap-1">
            {NAV.map((item) => {
              const active =
                item.href === "/"
                  ? pathname === "/"
                  : pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "relative rounded-md px-3 py-2 font-mono text-xs uppercase tracking-wider transition-colors duration-150",
                    active
                      ? "text-white"
                      : "text-slate-400 hover:bg-white/10 hover:text-white",
                  )}
                >
                  {item.label}
                  {active ? (
                    <span className="absolute inset-x-3 -bottom-px h-0.5 rounded-full bg-brand-blue" />
                  ) : null}
                </Link>
              );
            })}
          </nav>
        </div>
        <div className="flex items-center gap-3">
          <span className="hidden font-mono text-xs text-slate-400 md:block">
            {email}
          </span>
          <SignOutButton />
        </div>
      </div>
    </header>
  );
}
