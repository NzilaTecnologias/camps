import { getCurrentUser } from "@/server/auth";
import { ResendVerification } from "./resend-verification";
import { Icon } from "./ui";

/** Aviso fixo enquanto a conta não tiver o e-mail confirmado. */
export async function VerifyEmailBanner() {
  const user = await getCurrentUser();
  if (!user || user.emailVerified) return null;
  return (
    <div role="status" className="border-b border-warning/30 bg-warning/15 text-sm text-foreground">
      <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center gap-x-2 gap-y-1 px-4 py-2">
        <Icon name="alert" className="h-4 w-4 text-warning" />
        <span>
          Confirme o seu e-mail: enviámos um link para <strong>{user.email}</strong>. Sem isso não pode pagar nem organizar
          eventos.
        </span>
        <ResendVerification />
      </div>
    </div>
  );
}
