import Link from "next/link";
import { logOutAction } from "@/app/(auth)/actions";
import { getCurrentUser } from "@/server/auth";

export async function UserMenu() {
  const user = await getCurrentUser();
  if (!user) {
    return (
      <Link href="/login" className="text-sm hover:underline">
        Entrar
      </Link>
    );
  }
  return (
    <div className="flex items-center gap-4 text-sm">
      <Link href="/registrations" className="hover:underline">
        Inscrições
      </Link>
      <Link href="/manage" className="hover:underline">
        Painel
      </Link>
      <span className="opacity-60">{user.name}</span>
      <form action={logOutAction}>
        <button type="submit" className="hover:underline">
          Sair
        </button>
      </form>
    </div>
  );
}
