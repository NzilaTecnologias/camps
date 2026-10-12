import Link from "next/link";
import { Suspense } from "react";
import { ActionForm } from "@/components/action-form";
import { Field } from "@/components/field";
import { Card } from "@/components/ui";
import { signUpAction } from "../actions";

type SearchParams = PageProps<"/signup">["searchParams"];

async function SignupForm({ searchParams }: { searchParams: SearchParams }) {
  const { next } = await searchParams;
  return (
    <ActionForm action={signUpAction} submitLabel="Criar conta" className="flex flex-col gap-4">
      <Field label="Nome" name="name" autoComplete="name" required />
      <Field label="E-mail" name="email" type="email" autoComplete="email" required />
      <Field
        label="Palavra-passe (mínimo de 8 caracteres)"
        name="password"
        type="password"
        autoComplete="new-password"
        minLength={8}
        required
      />
      {typeof next === "string" && <input type="hidden" name="next" value={next} />}
    </ActionForm>
  );
}

export default function SignupPage({ searchParams }: PageProps<"/signup">) {
  return (
    <div className="mx-auto max-w-sm py-8">
      <Card className="p-7">
        <h1 className="font-display text-4xl font-bold uppercase leading-none">Criar conta</h1>
        <p className="mt-2 mb-6 text-sm text-muted">
          Uma conta serve para se inscrever em torneios e para organizar os seus.
        </p>
        <Suspense fallback={null}>
          <SignupForm searchParams={searchParams} />
        </Suspense>
      </Card>
      <p className="mt-5 text-center text-sm text-muted">
        Já tem conta?{" "}
        <Link href="/login" className="font-semibold text-primary hover:underline">
          Entrar
        </Link>
      </p>
    </div>
  );
}
