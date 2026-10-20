import Link from "next/link";
import { logOutAction } from "@/app/(main)/(site)/(auth)/actions";
import { getCurrentUser } from "@/server/auth";
import { isPlatformAdmin } from "@/server/billing-config";
import { Icon, LinkButton } from "./ui";

const itemClass = "block rounded-md px-3 py-2 text-sm text-white/80 hover:bg-white/10 hover:text-white";

function initials(name: string) {
  const parts = name.split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
}

export async function UserMenu() {
  const user = await getCurrentUser();
  if (!user) {
    // Criar conta fica na página de login, para o cabeçalho ter só uma porta de entrada.
    return (
      <LinkButton href="/login" size="sm">
        Iniciar sessão
      </LinkButton>
    );
  }

  // Menu de conta compacto: deixa espaço ao menu principal, que fica ao centro do cabeçalho.
  return (
    <details className="group relative">
      <summary className="flex cursor-pointer list-none items-center gap-2 rounded-full py-1 pr-2 pl-1 text-sm hover:bg-white/10 [&::-webkit-details-marker]:hidden">
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-xs font-bold text-white">
          {initials(user.name)}
        </span>
        <span className="hidden max-w-36 truncate font-medium sm:block">{user.name}</span>
        <Icon name="chevron-right" className="h-4 w-4 rotate-90 text-white/60 transition-transform group-open:-rotate-90" />
      </summary>
      <div className="absolute top-full right-0 z-40 mt-2 w-60 rounded-xl border border-white/10 bg-ink p-2 shadow-2xl">
        <p className="truncate px-3 pt-1 pb-2 text-xs text-white/50">{user.email}</p>
        <Link href="/registrations" className={itemClass}>
          As minhas inscrições
        </Link>
        <Link href="/manage" className={itemClass}>
          Painel do organizador
        </Link>
        {isPlatformAdmin(user.email) && (
          <>
            <Link href="/admin/payouts" className={itemClass}>
              Repasses (administração)
            </Link>
            <Link href="/admin/federations" className={itemClass}>
              Federações (administração)
            </Link>
          </>
        )}
        <div className="my-1 border-t border-white/10" />
        <form action={logOutAction}>
          <button type="submit" className={`${itemClass} w-full text-left`}>
            Sair
          </button>
        </form>
      </div>
    </details>
  );
}
