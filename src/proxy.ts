import { NextResponse, type NextRequest } from "next/server";

// Mesmos nomes de SESSION_COOKIE (server/auth.ts) e ADMIN_COOKIE (server/admin/session.ts),
// que não podem ser importados aqui por usarem o banco.
const SESSION_COOKIE = "camps_session";
const ADMIN_COOKIE = "camps_admin";

/**
 * Checagem otimista: sem cookie de sessão nem tenta renderizar as páginas que exigem conta.
 * A validação de verdade (sessão existe, não expirou, usuário tem acesso) fica em server/.
 * A administração tem entrada e sessão próprias: a sessão do site não serve lá.
 */
export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  if (pathname.startsWith("/admin")) {
    if (pathname === "/admin/login" || request.cookies.has(ADMIN_COOKIE)) return NextResponse.next();
    return NextResponse.redirect(new URL("/admin/login", request.url));
  }
  if (!request.cookies.has(SESSION_COOKIE)) {
    const login = new URL("/login", request.url);
    login.searchParams.set("next", pathname + search);
    return NextResponse.redirect(login);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/manage/:path*", "/admin/:path*", "/memberships/:path*", "/registrations/:path*", "/events/:slug/divisions/:divisionId/register"],
};
