import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ActionForm } from "@/components/action-form";
import { Field } from "@/components/field";
import { Card, Icon } from "@/components/ui";
import { forgotPasswordAction } from "../actions";

export const metadata: Metadata = { title: "Esqueci-me da palavra-passe — Camps" };

async function Content({ searchParams }: { searchParams: PageProps<"/forgot-password">["searchParams"] }) {
  const { sent } = await searchParams;
  if (sent === "1") {
    return (
      <div className="rounded-lg bg-success/10 p-4 text-sm text-foreground">
        <p className="flex items-center gap-2 font-semibold text-success">
          <Icon name="check" /> Pedido recebido
        </p>
        <p className="mt-2">
          Se existir uma conta com esse e-mail, enviámos um link para definir uma nova palavra-passe. O link é válido durante
          60 minutos. Veja também a pasta de spam.
        </p>
      </div>
    );
  }
  return (
    <ActionForm action={forgotPasswordAction} submitLabel="Enviar link" className="flex flex-col gap-4">
      <Field label="E-mail da conta" name="email" type="email" autoComplete="email" required />
    </ActionForm>
  );
}

export default function ForgotPasswordPage({ searchParams }: PageProps<"/forgot-password">) {
  return (
    <div className="mx-auto max-w-sm py-8">
      <Card className="p-7">
        <h1 className="font-display text-4xl font-bold uppercase leading-none">Nova palavra-passe</h1>
        <p className="mt-2 mb-6 text-sm text-muted">Indique o e-mail da sua conta e enviamos um link para definir outra.</p>
        <Suspense fallback={null}>
          <Content searchParams={searchParams} />
        </Suspense>
      </Card>
      <p className="mt-5 text-center text-sm text-muted">
        Lembrou-se?{" "}
        <Link href="/login" className="font-semibold text-primary hover:underline">
          Entrar
        </Link>
      </p>
    </div>
  );
}
