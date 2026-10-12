"use client";

import Link from "next/link";
import { useState } from "react";

const LINKS = [
  { href: "/events", label: "Eventos" },
  { href: "/#funcionalidades", label: "Funcionalidades" },
  { href: "/#placar", label: "Placar e direto" },
  { href: "/#pagamentos", label: "Pagamentos" },
  { href: "/#como-funciona", label: "Como funciona" },
];

// No telemóvel estes dois saem da barra e passam para o painel do menu.
const ACCOUNT_LINKS = [
  { href: "/registrations", label: "As minhas inscrições" },
  { href: "/manage", label: "Painel do organizador" },
];

export function NavMenu() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <ul className="hidden items-center gap-1 md:flex">
        {LINKS.map((link) => (
          <li key={link.href}>
            <Link
              href={link.href}
              className="rounded-md px-3 py-2 text-sm text-white/70 transition-colors hover:bg-white/10 hover:text-white"
            >
              {link.label}
            </Link>
          </li>
        ))}
      </ul>

      <button
        type="button"
        aria-label={open ? "Fechar menu" : "Abrir menu"}
        aria-expanded={open}
        aria-controls="menu-movel"
        onClick={() => setOpen(!open)}
        className="order-last flex h-9 w-9 items-center justify-center rounded-md text-white hover:bg-white/10 md:hidden"
      >
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
          {open ? <path d="M6 6l12 12M18 6 6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
        </svg>
      </button>

      {open && (
        <div id="menu-movel" className="absolute inset-x-0 top-14 border-b border-white/10 bg-ink md:hidden">
          <ul className="mx-auto flex max-w-6xl flex-col px-4 py-3">
            {[...LINKS, ...ACCOUNT_LINKS].map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  onClick={() => setOpen(false)}
                  className="block rounded-md px-3 py-3 text-base text-white/80 hover:bg-white/10 hover:text-white"
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </>
  );
}
