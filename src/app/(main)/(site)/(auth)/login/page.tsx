import { Suspense } from "react";
import { ActionForm } from "@/components/action-form";
import { Field } from "@/components/field";
import { Card, LinkButton } from "@/components/ui";
import { logInAction } from "../actions";

type SearchParams = PageProps<"/login">["searchParams"];

async function LoginForm({ searchParams }: { searchParams: SearchParams }) {
  const { next } = await searchParams;
  // Quem cria conta a partir daqui volta para onde ia, como quem entra.
  const signupHref = typeof next === "string" ? `/signup?next=${encodeURIComponent(next)}` : "/signup";

  return (
    <>
      <ActionForm action={logInAction} submitLabel="Entrar" className="flex flex-col gap-4">
        <Field label="E-mail" name="email" type="email" autoComplete="email" required />
        <Field label="Palavra-passe" name="password" type="password" autoComplete="current-password" required />
        {typeof next === "string" && <input type="hidden" name="next" value={next} />}
      </ActionForm>

      <div className="my-6 flex items-center gap-3 text-xs uppercase tracking-wider text-muted">
        <span className="h-px flex-1 bg-line" />
        Ainda não tem conta?
        <span className="h-px flex-1 bg-line" />
      </div>
      <LinkButton href={signupHref} variant="secondary" className="w-full">
        Criar conta
      </LinkButton>
    </>
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
    </div>
  );
}
