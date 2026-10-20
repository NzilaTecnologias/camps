"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/** Separadores da página pública de uma federação; o ranking e a filiação só existem no Premium. */
export function FederationTabs({ slug, premium }: { slug: string; premium: boolean }) {
  const pathname = usePathname();
  const base = `/f/${slug}`;
  const tabs = [
    { href: base, label: "Início" },
    ...(premium ? [{ href: `${base}/ranking`, label: "Ranking" }] : []),
    { href: `${base}/academies`, label: "Academias filiadas" },
    ...(premium ? [{ href: `${base}/filiacao`, label: "Filiação" }] : []),
  ];
  return (
    <nav aria-label="Secções da federação" className="-mx-4 mb-8 flex gap-1 overflow-x-auto px-4">
      {tabs.map((tab) => {
        const active = pathname === tab.href;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? "page" : undefined}
            className={`whitespace-nowrap rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
              active ? "bg-foreground text-background" : "text-muted hover:bg-foreground/5 hover:text-foreground"
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
