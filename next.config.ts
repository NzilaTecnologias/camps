import type { NextConfig } from "next";

// Cabeçalhos de segurança para todas as respostas.
const securityHeaders = [
  // Nenhum site pode pôr as páginas da Camps num iframe (clickjacking). O OBS abre a
  // sobreposição como página, não como iframe, por isso continua a funcionar.
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'; base-uri 'self'; object-src 'none'" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
  // Só tem efeito em https; os navegadores ignoram-no em http://localhost.
  { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
];

const nextConfig: NextConfig = {
  cacheComponents: true,
  // Caches das páginas públicas (src/server/cache-tags.ts). Expiram em menos de 5 minutos, por isso
  // nunca entram no pré-render da build: são sempre lidas da base de dados em produção.
  cacheLife: {
    // Listas de eventos, academias e atletas.
    public: { stale: 30, revalidate: 15, expire: 60 },
    // Página do evento, chaves e transmissões, que mudam durante a prova.
    live: { stale: 30, revalidate: 5, expire: 30 },
  },
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
  // Miniaturas das transmissões do YouTube na página de Transmissão.
  images: {
    remotePatterns: [{ protocol: "https", hostname: "i.ytimg.com", pathname: "/vi/**" }],
  },
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
