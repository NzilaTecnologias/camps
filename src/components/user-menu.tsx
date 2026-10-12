import Link from "next/link";
import { logOutAction } from "@/app/(auth)/actions";
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
      <Link href="/registrations" className={linkClass}>
        Inscrições
      </Link>
      <Link href="/manage" className={linkClass}>
        Painel
      </Link>
      <span className="hidden border-l border-white/15 pl-4 font-medium sm:block">{user.name}</span>
      <form action={logOutAction}>
        <button type="submit" className={linkClass}>
          Sair
        </button>
      </form>
    </div>
  );
}
