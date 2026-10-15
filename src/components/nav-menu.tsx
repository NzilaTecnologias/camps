"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

type NavLink = { href: string; label: string };
type NavItem = NavLink | { label: string; children: NavLink[] };

const ITEMS: NavItem[] = [
  { href: "/", label: "Início" },
  { href: "/events", label: "Eventos" },
  { href: "/live", label: "Transmissão" },
  {
    label: "Sobre",
    children: [
      { href: "/about", label: "Sobre nós" },
      { href: "/pricing", label: "Preços" },
      { href: "/support", label: "Apoiar" },
      { href: "/sponsors", label: "Patrocínios" },
    ],
  },
  {
    label: "Comunidade",
    children: [
      { href: "/academies", label: "Academias" },
      { href: "/athletes", label: "Atletas" },
    ],
  },
];

// Em ecrãs estreitos estes dois saem da barra e passam para o painel do menu.
const ACCOUNT_LINKS: NavLink[] = [
  { href: "/registrations", label: "As minhas inscrições" },
  { href: "/manage", label: "Painel do organizador" },
];

const linkClass =
  "whitespace-nowrap rounded-md px-3 py-2 text-sm text-white/70 transition-colors hover:bg-white/10 hover:text-white";

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`}
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      aria-hidden="true"
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

export function NavMenu() {
  const [mobileOpen, setMobileOpen] = useState(false);
  // Submenu aberto no ecrã largo ("Sobre" ou "Comunidade").
  const [openGroup, setOpenGroup] = useState<string | null>(null);
  const desktopRef = useRef<HTMLUListElement>(null);

  // Fecha o submenu ao clicar fora dele ou ao carregar em Escape.
  useEffect(() => {
    if (!openGroup) return;
    const onPointer = (event: PointerEvent) => {
      if (!desktopRef.current?.contains(event.target as Node)) setOpenGroup(null);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpenGroup(null);
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [openGroup]);

  return (
    <>
      <ul ref={desktopRef} className="absolute left-1/2 hidden -translate-x-1/2 items-center gap-1 lg:flex">
        {ITEMS.map((item) =>
          "href" in item ? (
            <li key={item.href}>
              <Link href={item.href} className={linkClass}>
                {item.label}
              </Link>
            </li>
          ) : (
            <li key={item.label} className="relative">
              <button
                type="button"
                aria-expanded={openGroup === item.label}
                aria-haspopup="true"
                onClick={() => setOpenGroup(openGroup === item.label ? null : item.label)}
                className={`${linkClass} flex items-center gap-1 ${openGroup === item.label ? "bg-white/10 text-white" : ""}`}
              >
                {item.label}
                <Chevron open={openGroup === item.label} />
              </button>
              {openGroup === item.label && (
                <ul className="absolute top-full left-1/2 z-40 mt-2 w-52 -translate-x-1/2 rounded-xl border border-white/10 bg-ink p-2 shadow-2xl">
                  {item.children.map((child) => (
                    <li key={child.href}>
                      <Link
                        href={child.href}
                        onClick={() => setOpenGroup(null)}
                        className="block rounded-md px-3 py-2 text-sm text-white/80 hover:bg-white/10 hover:text-white"
                      >
                        {child.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ),
        )}
      </ul>

      <button
        type="button"
        aria-label={mobileOpen ? "Fechar menu" : "Abrir menu"}
        aria-expanded={mobileOpen}
        aria-controls="menu-movel"
        onClick={() => setMobileOpen(!mobileOpen)}
        className="order-last flex h-9 w-9 items-center justify-center rounded-md text-white hover:bg-white/10 lg:hidden"
      >
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
          {mobileOpen ? <path d="M6 6l12 12M18 6 6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
        </svg>
      </button>

      {mobileOpen && (
        <div
          id="menu-movel"
          className="absolute inset-x-0 top-14 max-h-[calc(100dvh-3.5rem)] overflow-y-auto border-b border-white/10 bg-ink lg:hidden"
        >
          <div className="mx-auto flex max-w-6xl flex-col px-4 py-3">
            {ITEMS.map((item) =>
              "href" in item ? (
                <MobileLink key={item.href} link={item} onNavigate={() => setMobileOpen(false)} />
              ) : (
                <div key={item.label} className="mt-2">
                  <p className="px-3 pt-2 pb-1 text-xs font-semibold uppercase tracking-wider text-white/45">{item.label}</p>
                  {item.children.map((child) => (
                    <MobileLink key={child.href} link={child} onNavigate={() => setMobileOpen(false)} />
                  ))}
                </div>
              ),
            )}
            <div className="mt-2 border-t border-white/10 pt-2">
              {ACCOUNT_LINKS.map((link) => (
                <MobileLink key={link.href} link={link} onNavigate={() => setMobileOpen(false)} />
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function MobileLink({ link, onNavigate }: { link: NavLink; onNavigate: () => void }) {
  return (
    <Link
      href={link.href}
      onClick={onNavigate}
      className="block rounded-md px-3 py-3 text-base text-white/80 hover:bg-white/10 hover:text-white"
    >
      {link.label}
    </Link>
  );
}
