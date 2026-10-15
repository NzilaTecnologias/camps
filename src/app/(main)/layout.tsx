import Link from "next/link";
import { Suspense, type ReactNode } from "react";
import { NavMenu } from "@/components/nav-menu";
import { UserMenu } from "@/components/user-menu";

const FOOTER_LINKS = [
  {
    title: "Atletas",
    links: [
      { href: "/events", label: "Encontrar eventos" },
      { href: "/registrations", label: "As minhas inscrições" },
      { href: "/login", label: "Entrar" },
      { href: "/signup", label: "Criar conta" },
    ],
  },
  {
    title: "Organizadores",
    links: [
      { href: "/manage", label: "Painel do organizador" },
      { href: "/manage/events/new", label: "Criar evento" },
      { href: "/live", label: "Transmissão" },
    ],
  },
  {
    title: "Comunidade",
    links: [
      { href: "/academies", label: "Academias" },
      { href: "/athletes", label: "Atletas" },
    ],
  },
  {
    title: "Sobre",
    links: [
      { href: "/about", label: "Sobre nós" },
      { href: "/pricing", label: "Preços" },
      { href: "/support", label: "Apoiar" },
      { href: "/sponsors", label: "Patrocínios" },
    ],
  },
];

function Logo() {
  return (
    <Link href="/" className="flex items-center gap-2">
      <span className="flex h-7 w-7 items-center justify-center rounded-md bg-primary font-display text-lg font-bold leading-none text-white">
        C
      </span>
      <span className="flex flex-col">
        <span className="font-display text-2xl font-bold uppercase leading-none tracking-wide text-white">Camps</span>
        <span className="hidden whitespace-nowrap text-[10px] font-medium uppercase leading-tight tracking-[0.14em] text-white/55 sm:block">
          Gestão de torneios
        </span>
      </span>
    </Link>
  );
}

export default function MainLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <header className="sticky top-0 z-30 border-b border-white/10 bg-ink text-white">
        <nav aria-label="Principal" className="relative mx-auto flex h-14 w-full max-w-6xl items-center gap-4 px-4">
          {/* O menu é centrado na página (ver NavMenu); as pontas ficam encostadas aos lados. */}
          <div className="flex flex-1 items-center">
            <Logo />
          </div>
          <NavMenu />
          <div className="flex flex-1 items-center justify-end">
            <Suspense fallback={null}>
              <UserMenu />
            </Suspense>
          </div>
        </nav>
      </header>
      <main className="flex-1">{children}</main>
      <footer className="border-t border-white/10 bg-ink text-white">
        <div className="mx-auto grid w-full max-w-6xl gap-10 px-4 py-12 sm:grid-cols-2 lg:grid-cols-[1.5fr_repeat(4,1fr)]">
          <div>
            <Logo />
            <p className="mt-3 max-w-xs text-sm text-white/60">
              Gestão de torneios de desportos de combate: inscrições, pagamentos, chaves e resultados.
            </p>
          </div>
          {FOOTER_LINKS.map((group) => (
            <div key={group.title}>
              <p className="text-xs font-semibold uppercase tracking-wider text-white/50">{group.title}</p>
              <ul className="mt-3 space-y-2 text-sm">
                {group.links.map((link) => (
                  <li key={link.href}>
                    <Link href={link.href} className="text-white/80 hover:text-white">
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </footer>
    </>
  );
}
