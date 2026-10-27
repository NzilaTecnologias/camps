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
  // A build produz .next/standalone com um server.js e só os ficheiros necessários: é o que vai
  // na imagem Docker (Dockerfile). A versão de cada implantação vem de NEXT_DEPLOYMENT_ID na build.
  output: "standalone",
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
  // Miniaturas das transmissões do YouTube na página de Transmissão.
  images: {
    remotePatterns: [{ protocol: "https", hostname: "i.ytimg.com", pathname: "/vi/**" }],
  },
  partialPrefetching: true,
  experimental: {
    // Por omissão um pedido a uma server action vai até 1 MB; as imagens dos eventos vão até 5 MB
    // (lib/image-file.ts), mais a margem do multipart.
    serverActions: { bodySizeLimit: "6mb" },
    // A cache em disco do Turbopack em desenvolvimento fica ligada (sem ela, as fontes do Google não
    // carregam nesta versão); quando fica estragada, scripts/dev-cache-guard.mjs apaga-a antes do
    // arranque. A build do Docker começa sempre de uma camada limpa: uma cache que nunca é lida
    // não serve.
    turbopackFileSystemCacheForBuild: false,
  },
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
