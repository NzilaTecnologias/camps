import { NextResponse, type NextRequest } from "next/server";

// Mesmo nome de SESSION_COOKIE em server/auth.ts, que não pode ser importado aqui por usar o banco.
const SESSION_COOKIE = "camps_session";

/**
 * Checagem otimista: sem cookie de sessão nem tenta renderizar as páginas que exigem conta.
 * A validação de verdade (sessão existe, não expirou, usuário tem acesso) fica em server/.
 */
export function proxy(request: NextRequest) {
  if (!request.cookies.has(SESSION_COOKIE)) {
    const login = new URL("/login", request.url);
    login.searchParams.set("next", request.nextUrl.pathname + request.nextUrl.search);
    return NextResponse.redirect(login);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/manage/:path*", "/registrations/:path*", "/events/:slug/divisions/:divisionId/register"],
};
