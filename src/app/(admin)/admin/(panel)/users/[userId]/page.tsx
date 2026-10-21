import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense, type ReactNode } from "react";
import { ActionForm } from "@/components/action-form";
import { AdminHeader } from "@/components/admin/parts";
import { Field } from "@/components/field";
import { DataTable } from "@/components/manage/parts";
import { RegistrationStatusBadge } from "@/components/status-badges";
import { BackLink, Badge, Card } from "@/components/ui";
import { ROLE_LABEL } from "@/lib/admin-permissions";
import { formatDate, formatDateTime, formatMoney } from "@/lib/format";
import { getUserDetail } from "@/server/admin/data";
import { pageStaff } from "@/server/admin/session";
import {
  endUserSessionsAction,
  reactivateUserAction,
  resendVerificationAdminAction,
  suspendUserAction,
  verifyUserEmailAction,
} from "../../../actions";

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex justify-between gap-4 border-b border-line py-2 text-sm last:border-0">
      <dt className="text-muted">{label}</dt>
      <dd className="text-right font-medium">{children}</dd>
    </div>
  );
}

async function UserDetail({ params }: { params: Promise<{ userId: string }> }) {
  const { userId } = await params;
  const staff = await pageStaff("users");
  const user = await getUserDetail(staff, userId);
  if (!user) notFound();

  return (
    <>
      <BackLink href="/admin/users">Utilizadores</BackLink>
      <div className="mt-3">
        <AdminHeader
          title={user.name}
          description={user.email}
          aside={
            <div className="flex flex-wrap gap-2">
              {user.deletedAt && <Badge tone="danger">Eliminada</Badge>}
              {user.suspendedAt && <Badge tone="danger">Suspensa</Badge>}
              {user.role && <Badge tone="primary">{ROLE_LABEL[user.role]}</Badge>}
            </div>
          }
        />
      </div>

      <div className="grid items-start gap-6 2xl:grid-cols-[minmax(0,1fr)_22rem]">
        <section className="grid min-w-0 gap-6">
          <Card className="p-5">
            <dl>
              <Row label="Conta criada">{formatDate(user.createdAt)}</Row>
              <Row label="E-mail">{user.emailVerifiedAt ? `confirmado a ${formatDate(user.emailVerifiedAt)}` : "por confirmar"}</Row>
              <Row label="Termos aceites">{user.termsAcceptedAt ? formatDate(user.termsAcceptedAt) : "—"}</Row>
              <Row label="Sessões abertas no site">{user.sessions}</Row>
              <Row label="Atletas / inscrições">
                {user._count.athletes} / {user._count.registrations}
              </Row>
              {user.suspendedAt && (
                <Row label="Suspensa">
                  {formatDateTime(user.suspendedAt)} · {user.suspendedReason}
                </Row>
              )}
            </dl>
          </Card>

          {(user.memberships.length > 0 || user.federations.length > 0) && (
            <Card className="p-5 text-sm">
              <h2 className="mb-3 font-display text-xl font-bold uppercase leading-none">Organizações e federações</h2>
              <ul className="space-y-1">
                {user.memberships.map((m) => (
                  <li key={m.organizer.id}>
                    {m.organizer.name} <span className="text-muted">· {m.role}</span>
                  </li>
                ))}
                {user.federations.map((f) => (
                  <li key={f.federation.id}>
                    <Link href={`/f/${f.federation.slug}`} className="hover:text-primary">
                      {f.federation.name}
                    </Link>{" "}
                    <span className="text-muted">· gestor da federação</span>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          <section>
            <h2 className="mb-3 font-display text-xl font-bold uppercase leading-none">Últimas inscrições</h2>
            {user.registrations.length === 0 ? (
              <p className="text-sm text-muted">Sem inscrições.</p>
            ) : (
              <DataTable head={["Atleta", "Evento e categoria", "Valor", "Estado"]}>
                {user.registrations.map((r) => (
                  <tr key={r.id}>
                    <td className="px-4 py-3">
                      {r.athlete.firstName} {r.athlete.lastName}
                    </td>
                    <td className="px-4 py-3">
                      <Link href={`/events/${r.event.slug}`} className="hover:text-primary">
                        {r.event.name}
                      </Link>
                      <p className="text-xs text-muted">{r.division.name}</p>
                    </td>
                    <td className="px-4 py-3 tabular-nums">{formatMoney(r.priceCents, "AOA")}</td>
                    <td className="px-4 py-3">
                      <RegistrationStatusBadge status={r.status} />
                    </td>
                  </tr>
                ))}
              </DataTable>
            )}
          </section>

          {user.history.length > 0 && (
            <section>
              <h2 className="mb-3 font-display text-xl font-bold uppercase leading-none">Histórico na administração</h2>
              <DataTable head={["Quando", "Quem", "O quê"]}>
                {user.history.map((entry) => (
                  <tr key={entry.id}>
                    <td className="px-4 py-3 text-muted">{formatDateTime(entry.createdAt)}</td>
                    <td className="px-4 py-3">{entry.actorEmail}</td>
                    <td className="px-4 py-3 font-mono text-xs">{entry.action}</td>
                  </tr>
                ))}
              </DataTable>
            </section>
          )}
        </section>

        {!user.deletedAt && (
          <Card className="grid gap-4 p-5">
            <h2 className="font-display text-xl font-bold uppercase leading-none">Ações</h2>
            {!user.emailVerifiedAt && (
              <div className="flex flex-wrap gap-2">
                <ActionForm action={verifyUserEmailAction.bind(null, user.id)} submitLabel="Confirmar e-mail" submitVariant="secondary">
                  {null}
                </ActionForm>
                <ActionForm action={resendVerificationAdminAction.bind(null, user.id)} submitLabel="Reenviar link" submitVariant="secondary">
                  {null}
                </ActionForm>
              </div>
            )}
            <ActionForm action={endUserSessionsAction.bind(null, user.id)} submitLabel="Terminar as sessões no site" submitVariant="secondary">
              {null}
            </ActionForm>
            {user.suspendedAt ? (
              <ActionForm action={reactivateUserAction.bind(null, user.id)} submitLabel="Reativar a conta">
                {null}
              </ActionForm>
            ) : user.id !== staff.id ? (
              <details className="rounded-lg border border-danger/40 p-3">
                <summary className="cursor-pointer text-sm font-semibold text-danger">Suspender a conta</summary>
                <ActionForm action={suspendUserAction.bind(null, user.id)} submitLabel="Suspender" className="mt-3 flex flex-col gap-3">
                  <Field label="Motivo (fica no registo)" name="reason" maxLength={300} required />
                  <p className="text-xs text-muted">Termina já todas as sessões e impede de entrar no site e na administração.</p>
                </ActionForm>
              </details>
            ) : null}
          </Card>
        )}
      </div>
    </>
  );
}

export default function AdminUserPage({ params }: PageProps<"/admin/users/[userId]">) {
  return (
    <Suspense fallback={<p className="text-sm text-muted">A carregar…</p>}>
      <UserDetail params={params} />
    </Suspense>
  );
}
