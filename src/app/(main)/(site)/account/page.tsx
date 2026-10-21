import type { Metadata } from "next";
import { Suspense, type ReactNode } from "react";
import { ActionForm } from "@/components/action-form";
import { Field } from "@/components/field";
import { Card, Icon, PageTitle, buttonClass } from "@/components/ui";
import { formatDate } from "@/lib/format";
import { prisma } from "@/lib/db";
import { deletionBlockers } from "@/server/account";
import { pendingEmailChange, requireUser } from "@/server/auth";
import {
  changePasswordAction,
  deleteAccountAction,
  endOtherSessionsAction,
  requestEmailChangeAction,
  updateNameAction,
} from "./actions";

export const metadata: Metadata = { title: "A minha conta — Camps", robots: { index: false } };

const OK_MESSAGE: Record<string, string> = {
  name: "Nome atualizado.",
  password: "Palavra-passe alterada. As sessões noutros aparelhos foram terminadas.",
  email: "Enviámos um link para o novo e-mail. A mudança só acontece quando o abrir.",
};

function Section({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return (
    <Card className="p-6">
      <h2 className="font-display text-2xl font-bold uppercase leading-none">{title}</h2>
      {description && <p className="mt-2 text-sm text-muted">{description}</p>}
      <div className="mt-5">{children}</div>
    </Card>
  );
}

async function Account({ searchParams }: { searchParams: PageProps<"/account">["searchParams"] }) {
  const [{ ok, n }, user] = await Promise.all([searchParams, requireUser()]);
  const [account, sessions, pendingEmail, blockers] = await Promise.all([
    prisma.user.findUniqueOrThrow({ where: { id: user.id }, select: { createdAt: true, emailVerifiedAt: true } }),
    prisma.session.count({ where: { userId: user.id, expiresAt: { gt: new Date() } } }),
    pendingEmailChange(user.id),
    deletionBlockers(user.id),
  ]);
  const okMessage =
    ok === "sessions" ? `Terminadas ${typeof n === "string" ? n : 0} sessões noutros aparelhos.` : typeof ok === "string" ? OK_MESSAGE[ok] : undefined;

  return (
    <div className="grid gap-6">
      {okMessage && (
        <p role="status" className="flex items-center gap-2 rounded-lg bg-success/10 px-4 py-3 text-sm font-semibold text-success">
          <Icon name="check" /> {okMessage}
        </p>
      )}

      <Section title="Perfil" description={`Conta criada a ${formatDate(account.createdAt)}.`}>
        <ActionForm action={updateNameAction} submitLabel="Guardar nome" className="flex max-w-md flex-col gap-4">
          <Field label="Nome" name="name" defaultValue={user.name} autoComplete="name" required maxLength={120} />
        </ActionForm>
      </Section>

      <Section title="E-mail" description="Para onde vão os comprovativos, os avisos e os links para entrar.">
        <p className="mb-4 text-sm">
          E-mail atual: <strong>{user.email}</strong>{" "}
          {account.emailVerifiedAt ? <span className="text-success">· confirmado</span> : <span className="text-warning">· por confirmar</span>}
        </p>
        {pendingEmail && (
          <p className="mb-4 rounded-lg bg-warning/10 px-3 py-2 text-sm">
            À espera de confirmação: <strong>{pendingEmail}</strong>. Abra o link que enviámos para esse endereço.
          </p>
        )}
        <ActionForm action={requestEmailChangeAction} submitLabel="Mudar e-mail" className="grid max-w-2xl gap-4 sm:grid-cols-2">
          <Field label="Novo e-mail" name="email" type="email" autoComplete="email" required />
          <Field label="Palavra-passe atual" name="password" type="password" autoComplete="current-password" required />
        </ActionForm>
      </Section>

      <Section title="Palavra-passe" description="Ao mudar, as sessões abertas noutros aparelhos terminam.">
        <ActionForm action={changePasswordAction} submitLabel="Mudar palavra-passe" className="grid max-w-2xl gap-4 sm:grid-cols-3">
          <Field label="Atual" name="current" type="password" autoComplete="current-password" required />
          <Field label="Nova (mínimo de 8)" name="password" type="password" autoComplete="new-password" minLength={8} required />
          <Field label="Repita a nova" name="confirmation" type="password" autoComplete="new-password" minLength={8} required />
        </ActionForm>
      </Section>

      <Section
        title="Sessões"
        description={`A conta está aberta em ${sessions} ${sessions === 1 ? "aparelho" : "aparelhos"} (incluindo este).`}
      >
        <ActionForm action={endOtherSessionsAction} submitLabel="Terminar a sessão nos outros aparelhos" submitVariant="secondary" className="flex">
          <span />
        </ActionForm>
      </Section>

      <Section
        title="Os seus dados"
        description="Uma cópia de tudo o que a Camps guarda sobre esta conta: perfil, atletas, inscrições, pagamentos, filiações e organizações."
      >
        <a href="/account/export" className={buttonClass("secondary")} download>
          <Icon name="external" /> Descarregar os meus dados (JSON)
        </a>
      </Section>

      <Card className="border-danger/40 p-6">
        <h2 className="font-display text-2xl font-bold uppercase leading-none text-danger">Eliminar conta</h2>
        <p className="mt-2 text-sm text-muted">
          Apaga o seu nome, e-mail, palavra-passe e os atletas que nunca competiram, e a conta deixa de poder entrar. Não
          se pode desfazer. Ficam no histórico, sem ligação a si, os pagamentos (obrigação fiscal) e os resultados de
          competições já disputadas.
        </p>
        {blockers.length > 0 ? (
          <ul className="mt-4 space-y-2 text-sm">
            {blockers.map((blocker) => (
              <li key={blocker} className="flex items-start gap-2 rounded-lg bg-warning/10 px-3 py-2">
                <Icon name="alert" className="mt-0.5 h-4 w-4 text-warning" /> {blocker}
              </li>
            ))}
          </ul>
        ) : (
          <details className="mt-4">
            <summary className="inline-flex cursor-pointer list-none items-center rounded-full border border-danger/50 px-4 py-2 text-sm font-semibold text-danger hover:bg-danger/10">
              Quero eliminar a minha conta
            </summary>
            <ActionForm action={deleteAccountAction} submitLabel="Eliminar definitivamente" className="mt-4 grid max-w-2xl gap-4 sm:grid-cols-2">
              <Field label="Palavra-passe atual" name="password" type="password" autoComplete="current-password" required />
              <Field label='Escreva "ELIMINAR"' name="confirmation" required autoComplete="off" />
            </ActionForm>
          </details>
        )}
      </Card>
    </div>
  );
}

export default function AccountPage({ searchParams }: PageProps<"/account">) {
  return (
    <div className="mx-auto max-w-4xl">
      <PageTitle>A minha conta</PageTitle>
      <div className="mt-8">
        <Suspense fallback={<p className="text-sm text-muted">A carregar…</p>}>
          <Account searchParams={searchParams} />
        </Suspense>
      </div>
    </div>
  );
}
