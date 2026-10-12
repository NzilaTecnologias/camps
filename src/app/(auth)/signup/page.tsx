import Link from "next/link";
import { Suspense } from "react";
import { ActionForm } from "@/components/action-form";
import { Field } from "@/components/field";
import { signUpAction } from "../actions";

type SearchParams = PageProps<"/signup">["searchParams"];

async function SignupForm({ searchParams }: { searchParams: SearchParams }) {
  const { next } = await searchParams;
  return (
    <ActionForm action={signUpAction} submitLabel="Criar conta" className="space-y-4">
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
    <div className="mx-auto max-w-sm">
      <h1 className="mb-6 text-2xl font-bold">Criar conta</h1>
      <Suspense fallback={null}>
        <SignupForm searchParams={searchParams} />
      </Suspense>
      <p className="mt-6 text-sm opacity-70">
        Já tem conta?{" "}
        <Link href="/login" className="underline">
          Entrar
        </Link>
      </p>
    </div>
  );
}
