import Link from "next/link";
import { Suspense } from "react";
import { ActionForm } from "@/components/action-form";
import { AdminHeader } from "@/components/admin/parts";
import { Field, SelectField } from "@/components/field";
import { DataTable } from "@/components/manage/parts";
import { Badge, Card } from "@/components/ui";
import { ROLE_DESCRIPTION, ROLE_LABEL, type StaffRole } from "@/lib/admin-permissions";
import { formatDateTime } from "@/lib/format";
import { listStaff } from "@/server/admin/data";
import { pageStaff } from "@/server/admin/session";
import { removeStaffAction, setStaffRoleAction } from "../../actions";

const ROLES: StaffRole[] = ["ADMIN", "FINANCE", "SUPPORT"];

async function Staff() {
  const staff = await pageStaff("staff");
  const members = await listStaff(staff);
  return (
    <>
      <AdminHeader
        title="Equipa"
        description="Quem administra a plataforma e com que papel. Tirar alguém da equipa termina logo as sessões de administração dessa pessoa."
      />
      <div className="grid items-start gap-6 2xl:grid-cols-[minmax(0,1fr)_22rem]">
        <section className="min-w-0">
          <DataTable head={["Pessoa", "Papel", "Sessão de administração", ""]}>
            {members.map((member) => (
              <tr key={member.id} className="align-top">
                <td className="px-4 py-3">
                  <Link href={`/admin/users/${member.id}`} className="font-semibold hover:text-primary">
                    {member.name}
                  </Link>
                  <p className="text-xs text-muted">{member.email}</p>
                </td>
                <td className="px-4 py-3">
                  {member.role && <Badge tone="primary">{ROLE_LABEL[member.role]}</Badge>}
                  {member.fromEnv && <p className="mt-1 text-xs text-muted">Definido no servidor (PLATFORM_ADMIN_EMAILS)</p>}
                  {member.suspendedAt && <Badge tone="danger">Suspensa</Badge>}
                </td>
                <td className="px-4 py-3 text-xs text-muted">
                  {member.adminSessions[0] ? `Aberta desde ${formatDateTime(member.adminSessions[0].createdAt)} · ${member.adminSessions[0].ip ?? "IP desconhecido"}` : "—"}
                </td>
                <td className="px-4 py-3 text-right">
                  {!member.fromEnv && member.id !== staff.id && (
                    <ActionForm action={removeStaffAction.bind(null, member.id)} submitLabel="Tirar da equipa" submitVariant="secondary">
                      {null}
                    </ActionForm>
                  )}
                </td>
              </tr>
            ))}
          </DataTable>
        </section>

        <Card className="p-5">
          <h2 className="mb-1 font-display text-xl font-bold uppercase leading-none">Acrescentar ou mudar papel</h2>
          <p className="mb-4 text-sm text-muted">A pessoa tem de ter conta no site com o e-mail confirmado. Depois entra em /admin/login com a mesma palavra-passe.</p>
          <ActionForm action={setStaffRoleAction} submitLabel="Guardar" className="flex flex-col gap-4">
            <Field label="E-mail da conta" name="email" type="email" required />
            <SelectField label="Papel" name="role" defaultValue="SUPPORT" required>
              {ROLES.map((role) => (
                <option key={role} value={role}>
                  {ROLE_LABEL[role]}
                </option>
              ))}
            </SelectField>
          </ActionForm>
          <ul className="mt-5 space-y-2 border-t border-line pt-4 text-xs text-muted">
            {ROLES.map((role) => (
              <li key={role}>
                <strong className="text-foreground">{ROLE_LABEL[role]}:</strong> {ROLE_DESCRIPTION[role]}
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </>
  );
}

export default function AdminStaffPage() {
  return (
    <Suspense fallback={<p className="text-sm text-muted">A carregar…</p>}>
      <Staff />
    </Suspense>
  );
}
