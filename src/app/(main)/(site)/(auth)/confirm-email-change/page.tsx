import type { Metadata } from "next";
import { Suspense } from "react";
import { ActionForm } from "@/components/action-form";
import { Card, Icon, LinkButton } from "@/components/ui";
import { tokenIsValid } from "@/server/auth";
import { confirmEmailChangeAction } from "../actions";

export const metadata: Metadata = { title: "Confirmar novo e-mail — Camps", referrer: "no-referrer" };

// Como na confirmação do registo, abrir o link não basta: é o botão que confirma, para os
// serviços de e-mail que abrem os links sozinhos não gastarem o link.
async function Content({ searchParams }: { searchParams: PageProps<"/confirm-email-change">["searchParams"] }) {
  const { token, done } = await searchParams;
  if (done === "1") {
    return (
      <>
        <p className="mb-5 flex items-center gap-2 rounded-lg bg-success/10 px-3 py-2 text-sm font-semibold text-success">
          <Icon name="check" /> O novo e-mail já está em uso na sua conta.
        </p>
        <LinkButton href="/account" className="w-full">
          A minha conta
        </LinkButton>
      </>
    );
  }
  if (typeof token !== "string" || !(await tokenIsValid(token, "EMAIL_CHANGE"))) {
    return (
      <p className="rounded-lg bg-danger/10 px-3 py-2 text-sm font-medium text-danger">
        Este link já foi usado ou expirou. Peça a mudança outra vez em A minha conta.
      </p>
    );
  }
  return (
    <ActionForm action={confirmEmailChangeAction} submitLabel="Confirmar novo e-mail" className="flex flex-col gap-4">
      <input type="hidden" name="token" value={token} />
    </ActionForm>
  );
}

export default function ConfirmEmailChangePage({ searchParams }: PageProps<"/confirm-email-change">) {
  return (
    <div className="mx-auto max-w-sm py-8">
      <Card className="p-7">
        <h1 className="mb-6 font-display text-4xl font-bold uppercase leading-none">Novo e-mail</h1>
        <Suspense fallback={null}>
          <Content searchParams={searchParams} />
        </Suspense>
      </Card>
    </div>
  );
}
