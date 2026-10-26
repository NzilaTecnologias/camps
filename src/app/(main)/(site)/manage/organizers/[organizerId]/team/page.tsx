import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ActionForm } from "@/components/action-form";
import { Field, SelectField } from "@/components/field";
import { DataTable } from "@/components/manage/parts";
import { BackLink, Badge, Card, PageTitle } from "@/components/ui";
import {
  ORGANIZER_ROLE_DESCRIPTION,
  ORGANIZER_ROLE_LABEL,
  ORGANIZER_ROLES,
  canOrganizer,
} from "@/lib/organizer-permissions";
import { requireUser } from "@/server/auth";
import { getOrganizerTeam } from "@/server/team";
import { removeMemberAction, setMemberRoleAction } from "../../../actions";

async function Team({ params }: { params: Promise<{ organizerId: string }> }) {
  const { organizerId } = await params;
  const user = await requireUser();
  const organizer = await getOrganizerTeam(user.id, organizerId);
  if (!organizer) notFound();
  const manages = canOrganizer(organizer.myRole, "team");

  return (
    <>
      <BackLink href="/manage">Os meus eventos</BackLink>
      <header className="mt-3 mb-8 border-b border-line pb-6">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">{organizer.name}</p>
        <div className="mt-2">
          <PageTitle>Equipa</PageTitle>
        </div>
        <p className="mt-2 max-w-2xl text-sm text-muted">
          Quem gere os eventos desta organização e o que cada pessoa pode fazer. Num torneio com várias áreas, cada
          mesário entra com a sua conta.
        </p>
      </header>

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <section className="min-w-0">
          <DataTable head={["Pessoa", "Papel", ""]}>
            {organizer.members.map((member) => (
              <tr key={member.userId} className="align-top">
                <td className="px-4 py-3">
                  <p className="font-semibold">
                    {member.user.name}
                    {member.userId === user.id && <span className="font-normal text-muted"> (você)</span>}
                  </p>
                  <p className="text-xs text-muted">{member.user.email}</p>
                </td>
                <td className="px-4 py-3">
                  <Badge tone={member.role === "OWNER" ? "primary" : "neutral"}>{ORGANIZER_ROLE_LABEL[member.role]}</Badge>
                  {member.user.suspendedAt && (
                    <span className="ml-2">
                      <Badge tone="danger">Suspensa</Badge>
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-right">
                  {(manages || member.userId === user.id) && (
                    <ActionForm
                      action={removeMemberAction.bind(null, organizer.id, member.userId)}
                      submitLabel={member.userId === user.id ? "Sair da organização" : "Tirar da equipa"}
                      submitVariant="secondary"
                    >
                      {null}
                    </ActionForm>
                  )}
                </td>
              </tr>
            ))}
          </DataTable>
        </section>

        <Card className="p-5">
          {manages ? (
            <>
              <h2 className="mb-1 font-display text-xl font-bold uppercase leading-none">Acrescentar ou mudar papel</h2>
              <p className="mb-4 text-sm text-muted">
                A pessoa tem de ter conta na Camps com o e-mail confirmado. Recebe um e-mail quando entra na equipa.
              </p>
              <ActionForm action={setMemberRoleAction.bind(null, organizer.id)} submitLabel="Guardar" className="flex flex-col gap-4">
                <Field label="E-mail da conta" name="email" type="email" required />
                <SelectField label="Papel" name="role" defaultValue="STAFF" required>
                  {ORGANIZER_ROLES.map((role) => (
                    <option key={role} value={role}>
                      {ORGANIZER_ROLE_LABEL[role]}
                    </option>
                  ))}
                </SelectField>
              </ActionForm>
            </>
          ) : (
            <>
              <h2 className="mb-1 font-display text-xl font-bold uppercase leading-none">Papéis</h2>
              <p className="text-sm text-muted">Só o dono acrescenta pessoas ou muda papéis.</p>
            </>
          )}
          <ul className="mt-5 space-y-2 border-t border-line pt-4 text-xs text-muted">
            {ORGANIZER_ROLES.map((role) => (
              <li key={role}>
                <strong className="text-foreground">{ORGANIZER_ROLE_LABEL[role]}:</strong> {ORGANIZER_ROLE_DESCRIPTION[role]}
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </>
  );
}

export default function OrganizerTeamPage({ params }: PageProps<"/manage/organizers/[organizerId]/team">) {
  return (
    <Suspense fallback={<p className="text-sm text-muted">A carregar…</p>}>
      <Team params={params} />
    </Suspense>
  );
}
