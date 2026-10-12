import type { Metadata } from "next";
import { Barlow_Condensed, Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import { Suspense } from "react";
import { UserMenu } from "@/components/user-menu";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const barlow = Barlow_Condensed({
  variable: "--font-barlow",
  subsets: ["latin"],
  weight: ["600", "700"],
});

export const metadata: Metadata = {
  title: "Camps",
  description: "Gestão de torneios de desportos de combate",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="pt-AO"
      className={`${geistSans.variable} ${geistMono.variable} ${barlow.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <header className="sticky top-0 z-20 border-b border-white/10 bg-ink text-white">
          <nav className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between gap-4 px-4">
            <div className="flex items-center gap-6">
              <Link href="/" className="flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-md bg-primary font-display text-lg font-bold leading-none">
                  C
                </span>
                <span className="font-display text-2xl font-bold uppercase leading-none tracking-wide">Camps</span>
              </Link>
              <Link href="/" className="hidden text-sm text-white/70 hover:text-white sm:block">
                Eventos
              </Link>
            </div>
            <Suspense fallback={null}>
              <UserMenu />
            </Suspense>
          </nav>
        </header>
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">{children}</main>
        <footer className="border-t border-line">
          <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-2 px-4 py-5 text-sm text-muted">
            <span>
              <span className="font-display text-base font-bold uppercase tracking-wide text-foreground">Camps</span> ·
              Gestão de torneios de desportos de combate
            </span>
            <Link href="/manage" className="hover:text-foreground">
              Organizar um evento
            </Link>
          </div>
        </footer>
      </body>
    </html>
  );
}
