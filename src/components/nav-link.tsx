"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function NavLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const isActive = pathname === href;

  return (
    <Link
      href={href}
      className={`rounded-full border px-4 py-2 text-sm font-medium transition-colors ${
        isActive
          ? "border-[color:var(--color-foreground)] bg-[color:var(--color-foreground)] text-white"
          : "border-[color:var(--color-border)] bg-[color:var(--color-surface-strong)] text-[color:var(--color-foreground)] hover:border-[color:var(--color-accent)] hover:text-[color:var(--color-accent)]"
      }`}
    >
      {children}
    </Link>
  );
}
