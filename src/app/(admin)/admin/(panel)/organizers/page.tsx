import Link from "next/link";
import { Suspense } from "react";
import { AdminHeader, SearchBox, textOf } from "@/components/admin/parts";
import { DataTable } from "@/components/manage/parts";
import { Badge, Empty } from "@/components/ui";
import { can } from "@/lib/admin-permissions";
import { listOrganizers } from "@/server/admin/data";
import { pageStaff } from "@/server/admin/session";
import { ActionForm } from "@/components/action-form";
import { Field } from "@/components/field";
import { adjustCreditsAction } from "../../actions";

async function Organizers({ searchParams }: { searchParams: PageProps<"/admin/organizers">["searchParams"] }) {
  const staff = await pageStaff("organizers");
  const q = textOf((await searchParams).q);
  const organizers = await listOrganizers(staff, q);
  const linkUsers = can(staff.role, "users");
  const finance = can(staff.role, "finance");
  return (
    <>
      <AdminHeader title="Organizações" description="Clubes, ligas e associações que organizam eventos na Camps, com os donos, o saldo de créditos e as contas onde recebem as inscrições." />
      <SearchBox action="/admin/organizers" q={q} placeholder="Nome ou identificador" />
      {organizers.length === 0 ? (
        <Empty>Nenhuma organização encontrada.</Empty>
      ) : (
        <DataTable head={["Organização", "Donos", "Eventos", "Créditos", "Recebe por"]}>
          {organizers.map((organizer) => (
            <tr key={organizer.id} className="align-top">
              <td className="px-4 py-3">
                <Link href={`/admin/events?q=${encodeURIComponent(organizer.name)}`} className="font-semibold hover:text-primary">
                  {organizer.name}
                </Link>
                <p className="font-mono text-xs text-muted">{organizer.slug}</p>
              </td>
              <td className="px-4 py-3 text-xs">
                {organizer.members.map(({ user }) => (
                  <p key={user.id}>
                    {linkUsers ? (
                      <Link href={`/admin/users/${user.id}`} className="hover:text-primary">
                        {user.name}
                      </Link>
                    ) : (
                      user.name
                    )}{" "}
                    <span className="text-muted">{user.email}</span>
                  </p>
                ))}
              </td>
              <td className="px-4 py-3 tabular-nums">{organizer._count.events}</td>
              <td className="px-4 py-3">
                <p className="font-semibold tabular-nums">{organizer.credits}</p>
                {finance && (
                  <details className="mt-1 text-xs">
                    <summary className="cursor-pointer text-primary">Acertar</summary>
                    <ActionForm action={adjustCreditsAction.bind(null, organizer.id)} submitLabel="Aplicar" submitVariant="secondary" className="mt-2 flex w-56 flex-col gap-2">
                      <Field label="Créditos (negativo para tirar)" name="delta" inputMode="numeric" placeholder="50" required />
                      <Field label="Motivo" name="note" maxLength={300} required />
                    </ActionForm>
                  </details>
                )}
              </td>
              <td className="px-4 py-3 text-xs">
                {organizer.paymentAccount?.proxypayPosId && <p>Multicaixa Express{organizer.paymentAccount.proxypaySandbox && " (testes)"}</p>}
                {organizer.paymentAccount?.paypalClientId && <p>PayPal{organizer.paymentAccount.paypalSandbox && " (testes)"}</p>}
                {!organizer.paymentAccount?.proxypayPosId && !organizer.paymentAccount?.paypalClientId && <Badge tone="warning">Sem conta</Badge>}
                {organizer.billingNif && <p className="mt-1 text-muted">NIF {organizer.billingNif}</p>}
              </td>
            </tr>
          ))}
        </DataTable>
      )}
    </>
  );
}

export default function AdminOrganizersPage({ searchParams }: PageProps<"/admin/organizers">) {
  return (
    <Suspense fallback={<p className="text-sm text-muted">A carregar…</p>}>
      <Organizers searchParams={searchParams} />
    </Suspense>
  );
}
