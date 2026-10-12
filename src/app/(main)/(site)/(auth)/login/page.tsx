import Link from "next/link";
import { Suspense } from "react";
import { ActionForm } from "@/components/action-form";
import { Field } from "@/components/field";
import { Card } from "@/components/ui";
import { logInAction } from "../actions";

type SearchParams = PageProps<"/login">["searchParams"];

async function LoginForm({ searchParams }: { searchParams: SearchParams }) {
  const { next } = await searchParams;
  return (
    <ActionForm action={logInAction} submitLabel="Entrar" className="flex flex-col gap-4">
      <Field label="E-mail" name="email" type="email" autoComplete="email" required />
      <Field label="Palavra-passe" name="password" type="password" autoComplete="current-password" required />
      {typeof next === "string" && <input type="hidden" name="next" value={next} />}
    </ActionForm>
  );
}

export default function LoginPage({ searchParams }: PageProps<"/login">) {
  return (
    <div className="mx-auto max-w-sm py-8">
      <Card className="p-7">
        <h1 className="font-display text-4xl font-bold uppercase leading-none">Entrar</h1>
        <p className="mt-2 mb-6 text-sm text-muted">Aceda às suas inscrições e ao painel do organizador.</p>
        <Suspense fallback={null}>
          <LoginForm searchParams={searchParams} />
        </Suspense>
      </Card>
      <p className="mt-5 text-center text-sm text-muted">
        Ainda não tem conta?{" "}
        <Link href="/signup" className="font-semibold text-primary hover:underline">
          Criar conta
        </Link>
      </p>
    </div>
  );
}
