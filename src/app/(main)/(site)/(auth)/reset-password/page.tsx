import type { Metadata } from "next";
import { Suspense } from "react";
import { ActionForm } from "@/components/action-form";
import { Field } from "@/components/field";
import { Card, LinkButton } from "@/components/ui";
import { tokenIsValid } from "@/server/auth";
import { resetPasswordAction } from "../actions";

export const metadata: Metadata = { title: "Definir palavra-passe — Camps", referrer: "no-referrer" };

async function ResetForm({ searchParams }: { searchParams: PageProps<"/reset-password">["searchParams"] }) {
  const { token } = await searchParams;
  if (typeof token !== "string" || !(await tokenIsValid(token, "PASSWORD_RESET"))) {
    return (
      <>
        <p className="mb-5 rounded-lg bg-danger/10 px-3 py-2 text-sm font-medium text-danger">
          Este link já foi usado ou expirou. Os links para definir a palavra-passe valem 60 minutos e só uma vez.
        </p>
        <LinkButton href="/forgot-password" className="w-full">
          Pedir um link novo
        </LinkButton>
      </>
    );
  }
  return (
    <ActionForm action={resetPasswordAction} submitLabel="Guardar e entrar" className="flex flex-col gap-4">
      <input type="hidden" name="token" value={token} />
      <Field
        label="Nova palavra-passe (mínimo de 8 caracteres)"
        name="password"
        type="password"
        autoComplete="new-password"
        minLength={8}
        required
      />
      <Field label="Repita a nova palavra-passe" name="confirmation" type="password" autoComplete="new-password" minLength={8} required />
      <p className="text-xs text-muted">Por segurança, todas as sessões abertas noutros aparelhos são terminadas.</p>
    </ActionForm>
  );
}

export default function ResetPasswordPage({ searchParams }: PageProps<"/reset-password">) {
  return (
    <div className="mx-auto max-w-sm py-8">
      <Card className="p-7">
        <h1 className="mb-6 font-display text-4xl font-bold uppercase leading-none">Definir palavra-passe</h1>
        <Suspense fallback={null}>
          <ResetForm searchParams={searchParams} />
        </Suspense>
      </Card>
    </div>
  );
}
