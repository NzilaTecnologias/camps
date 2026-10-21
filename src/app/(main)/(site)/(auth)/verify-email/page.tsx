import type { Metadata } from "next";
import { Suspense } from "react";
import { ActionForm } from "@/components/action-form";
import { Card, Icon, LinkButton } from "@/components/ui";
import { tokenIsValid } from "@/server/auth";
import { verifyEmailAction } from "../actions";

export const metadata: Metadata = { title: "Confirmar e-mail — Camps", referrer: "no-referrer" };

// O link do e-mail abre esta página e só o botão confirma: alguns serviços de e-mail abrem os
// links sozinhos para os analisar, e isso não deve gastar o link.
async function Content({ searchParams }: { searchParams: PageProps<"/verify-email">["searchParams"] }) {
  const { token, done } = await searchParams;
  if (done === "1") {
    return (
      <>
        <p className="mb-5 flex items-center gap-2 rounded-lg bg-success/10 px-3 py-2 text-sm font-semibold text-success">
          <Icon name="check" /> E-mail confirmado. Já pode pagar inscrições e organizar eventos.
        </p>
        <LinkButton href="/events" className="w-full">
          Ver eventos
        </LinkButton>
      </>
    );
  }
  if (typeof token !== "string" || !(await tokenIsValid(token, "VERIFY_EMAIL"))) {
    return (
      <p className="rounded-lg bg-danger/10 px-3 py-2 text-sm font-medium text-danger">
        Este link já foi usado ou expirou. Entre na sua conta e use &quot;Reenviar&quot; no aviso no topo da página.
      </p>
    );
  }
  return (
    <ActionForm action={verifyEmailAction} submitLabel="Confirmar e-mail" className="flex flex-col gap-4">
      <input type="hidden" name="token" value={token} />
    </ActionForm>
  );
}

export default function VerifyEmailPage({ searchParams }: PageProps<"/verify-email">) {
  return (
    <div className="mx-auto max-w-sm py-8">
      <Card className="p-7">
        <h1 className="mb-6 font-display text-4xl font-bold uppercase leading-none">Confirmar e-mail</h1>
        <Suspense fallback={null}>
          <Content searchParams={searchParams} />
        </Suspense>
      </Card>
    </div>
  );
}
