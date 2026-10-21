import Link from "next/link";
import { Suspense } from "react";
import { DataTable, Notice, SectionHeader, StatTile } from "@/components/manage/parts";
import { EventStatusBadge } from "@/components/status-badges";
import { Badge, Card, Icon } from "@/components/ui";
import { PLAN_FEATURES, PLAN_LABEL, planActive } from "@/lib/federation-rules";
import { formatDate, formatMoney } from "@/lib/format";
import { requireUser } from "@/server/auth";
import { federationPlanPriceCents } from "@/server/billing-config";
import { getFederationOverview } from "@/server/federations";

async function Overview({ params }: { params: Promise<{ federationId: string }> }) {
  const { federationId } = await params;
  const user = await requireUser();
  const { federation, organizers, academies, activeMembers, events } = await getFederationOverview(user.id, federationId);
  const active = planActive(federation);
  const base = `/manage/federations/${federation.id}`;

  return (
    <>
      <SectionHeader title="Visão geral" description="A federação reúne os eventos das organizações associadas, filia academias e atletas e publica o ranking." />

      {!active && (
        <div className="mb-8">
          <Notice>
            O plano desta federação não está ativo. A assinatura é anual (
            {formatMoney(federationPlanPriceCents("BASIC"), "AOA")} Básico ou {formatMoney(federationPlanPriceCents("PREMIUM"), "AOA")}{" "}
            Premium) e paga-se online em{" "}
            <Link href={`${base}/billing`} className="font-semibold text-primary hover:underline">
              Plano e faturas
            </Link>
            . Até lá pode preparar a página e os planos de filiação.
          </Notice>
        </div>
      )}

      <div className="mb-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile icon="users" tone="primary" label="Organizações" value={organizers.length} href={`${base}/organizers`} />
        <StatTile icon="layers" label="Academias filiadas" value={academies.length} href={`${base}/academies`} />
        <StatTile icon="ticket" tone="success" label="Atletas filiados" value={activeMembers} hint="Com filiação em dia" href={`${base}/members`} />
        <StatTile icon="calendar" label="Eventos" value={events.length} />
      </div>

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <section>
          <h3 className="mb-3 font-display text-xl font-bold uppercase leading-none">Eventos da federação</h3>
          {events.length === 0 ? (
            <p className="text-sm text-muted">
              Ainda não há eventos. As organizações associadas escolhem a federação na Página do evento.
            </p>
          ) : (
            <DataTable head={["Evento", "Organização", "Data", "Filiação", "Estado"]}>
              {events.map((event) => (
                <tr key={event.id}>
                  <td className="px-4 py-3">
                    <Link href={`/events/${event.slug}`} className="font-semibold hover:text-primary">
                      {event.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-muted">{event.organizer.name}</td>
                  <td className="px-4 py-3 text-muted">{formatDate(event.startsAt)}</td>
                  <td className="px-4 py-3">{event.requiresMembership ? <Badge tone="primary">Exigida</Badge> : <span className="text-xs text-muted">—</span>}</td>
                  <td className="px-4 py-3">
                    <EventStatusBadge status={event.status} />
                  </td>
                </tr>
              ))}
            </DataTable>
          )}
        </section>

        <Card className="p-5">
          <h3 className="mb-3 font-display text-xl font-bold uppercase leading-none">
            {active ? `Plano ${PLAN_LABEL[federation.plan!]}` : "Planos"}
          </h3>
          <ul className="space-y-2 text-sm">
            {PLAN_FEATURES[active ? federation.plan! : "PREMIUM"].map((feature) => (
              <li key={feature} className="flex items-start gap-2">
                <Icon name="check" className="mt-0.5 h-4 w-4 text-success" />
                {feature}
              </li>
            ))}
          </ul>
          {active && <p className="mt-4 text-xs text-muted">Válido até {formatDate(federation.planExpiresAt!)}.</p>}
        </Card>
      </div>
    </>
  );
}

export default function FederationOverviewPage({ params }: PageProps<"/manage/federations/[federationId]">) {
  return (
    <Suspense fallback={<p className="text-sm text-muted">A carregar…</p>}>
      <Overview params={params} />
    </Suspense>
  );
}
