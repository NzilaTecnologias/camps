import type { Metadata } from "next";
import { Barlow_Condensed, Geist, Geist_Mono } from "next/font/google";
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
  title: "Camps — Sistema de gestão de torneios de desportos de combate",
  description: "Sistema de gestão de competições de desportos de combate em Angola: inscrições, pagamentos, chaves, placar, transmissão e resultados.",
};

// Só o esqueleto: o cabeçalho e o rodapé ficam em (main), porque os ecrãs de placar não os têm.
export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="pt-AO"
      // O script do <head> acrescenta a classe "js" antes de o React assumir a página.
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} ${barlow.variable} h-full antialiased`}
    >
      <head>
        {/* Marca que há JavaScript antes de pintar a página: só então os elementos do Reveal começam escondidos. */}
        <script dangerouslySetInnerHTML={{ __html: "document.documentElement.classList.add('js')" }} />
      </head>
      {/* Todo o site usa o fundo escuro da página inicial, seja qual for o tema do sistema. */}
      <body className="dark-scope min-h-full flex flex-col">{children}</body>
    </html>
  );
}
