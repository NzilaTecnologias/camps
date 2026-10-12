import Link from "next/link";
import { Suspense } from "react";
import { ActionForm } from "@/components/action-form";
import { Field } from "@/components/field";
import { logInAction } from "../actions";

type SearchParams = PageProps<"/login">["searchParams"];

async function LoginForm({ searchParams }: { searchParams: SearchParams }) {
  const { next } = await searchParams;
  return (
    <ActionForm action={logInAction} submitLabel="Entrar" className="space-y-4">
      <Field label="E-mail" name="email" type="email" autoComplete="email" required />
      <Field label="Palavra-passe" name="password" type="password" autoComplete="current-password" required />
      {typeof next === "string" && <input type="hidden" name="next" value={next} />}
    </ActionForm>
  );
}

export default function LoginPage({ searchParams }: PageProps<"/login">) {
  return (
    <div className="mx-auto max-w-sm">
      <h1 className="mb-6 text-2xl font-bold">Entrar</h1>
      <Suspense fallback={null}>
        <LoginForm searchParams={searchParams} />
      </Suspense>
      <p className="mt-6 text-sm opacity-70">
        Ainda não tem conta?{" "}
        <Link href="/signup" className="underline">
          Criar conta
        </Link>
      </p>
    </div>
  );
}
