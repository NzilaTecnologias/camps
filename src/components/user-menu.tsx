import Link from "next/link";
import { logOutAction } from "@/app/(main)/(site)/(auth)/actions";
import { getCurrentUser } from "@/server/auth";
import { LinkButton } from "./ui";

const linkClass = "text-white/70 hover:text-white";

export async function UserMenu() {
  const user = await getCurrentUser();
  if (!user) {
    return (
      <div className="flex items-center gap-4 text-sm">
        <Link href="/login" className={linkClass}>
          Entrar
        </Link>
        <LinkButton href="/signup" size="sm">
          Criar conta
        </LinkButton>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-4 text-sm">
      {/* No telemóvel estas duas ligações estão no menu de navegação. */}
      <Link href="/registrations" className={`hidden md:block ${linkClass}`}>
        Inscrições
      </Link>
      <Link href="/manage" className={`hidden md:block ${linkClass}`}>
        Painel
      </Link>
      <span className="max-w-40 truncate font-medium md:border-l md:border-white/15 md:pl-4">{user.name}</span>
      <form action={logOutAction}>
        <button type="submit" className={linkClass}>
          Sair
        </button>
      </form>
    </div>
  );
}
