import type { ReactNode } from "react";

/** Páginas interiores: conteúdo centrado. A página inicial fica de fora para ocupar a largura toda. */
export default function SiteLayout({ children }: { children: ReactNode }) {
  return <div className="mx-auto w-full max-w-6xl px-4 py-8">{children}</div>;
}
