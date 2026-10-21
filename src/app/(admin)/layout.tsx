import type { Metadata } from "next";
import type { ReactNode } from "react";

// Área de administração: fora do site (sem o cabeçalho, o rodapé e os menus públicos) e
// invisível aos motores de busca. Quem entra e o que vê decide-se em server/admin/session.ts.
export const metadata: Metadata = {
  title: "Administração — Camps",
  robots: { index: false, follow: false },
};

export default function AdminRootLayout({ children }: { children: ReactNode }) {
  return <div className="flex min-h-dvh flex-col bg-[#0b0c0f] text-foreground">{children}</div>;
}
