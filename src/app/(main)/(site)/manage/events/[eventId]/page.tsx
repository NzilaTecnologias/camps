import Link from "next/link";
import { Suspense } from "react";
import { SectionHeader, StatTile } from "@/components/manage/parts";
import { RegistrationStatusBadge } from "@/components/status-badges";
import { Card, Empty, Icon } from "@/components/ui";
import { formatMoney } from "@/lib/format";
import { canOrganizer, type OrganizerPermission } from "@/lib/organizer-permissions";
import { requireUser } from "@/server/auth";
import { getEventOverview, getEventWorkspace } from "@/server/organizer";

type Step = { done: boolean; label: string; hint: string; href: string };

function Checklist({ steps }: { steps: Step[] }) {
  const done = steps.filter((step) => step.done).length;
  return (
    <Card className="p-5">
      <div className="mb-4 flex items-end justify-between gap-3">
        <h3 className="font-display text-xl font-bold uppercase leading-none">Próximos passos</h3>
        <span className="text-sm text-muted">
          {done} de {steps.length}
        </span>
      </div>
      <div className="mb-5 h-2 overflow-hidden rounded-full bg-foreground/8">
        <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${(done / steps.length) * 100}%` }} />
      </div>
      <ol className="space-y-1">
        {steps.map((step) => (
          <li key={step.label}>
            <Link href={step.href} className="group flex items-start gap-3 rounded-lg p-2 transition-colors hover:bg-foreground/5">
              <span
                className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${
                  step.done ? "border-success bg-success text-white" : "border-line"
                }`}
              >
                {step.done && <Icon name="check" className="h-3 w-3" />}
              </span>
              <span className="min-w-0">
                <span className={`block text-sm font-semibold ${step.done ? "text-muted line-through" : "group-hover:text-primary"}`}>
                  {step.label}
                </span>
                {!step.done && <span className="block text-xs text-muted">{step.hint}</span>}
              </span>
            </Link>
          </li>
        ))}
      </ol>
    </Card>
  );
}

async function Overview({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  const user = await requireUser();
  const [event, stats] = await Promise.all([getEventWorkspace(user.id, eventId), getEventOverview(user.id, eventId)]);
  if (!event) return null;
  const base = `/manage/events/${event.id}`;
  const can = (permission: OrganizerPermission) => canOrganizer(event.role, permission);

  const steps: (Step & { permission: OrganizerPermission })[] = [
    { done: Boolean(event.description && event.venue), label: "Completar a página do evento", hint: "Descrição, local e mapa", href: `${base}/settings`, permission: "event" },
    { done: stats.divisions > 0, label: "Criar as categorias", hint: "Sexo, faixa, peso e preço", href: `${base}/divisions`, permission: "event" },
    { done: event.status === "PUBLISHED", label: "Publicar o evento", hint: "Abre as inscrições ao público", href: base, permission: "event" },
    { done: stats.paid > 0, label: "Receber inscrições", hint: "Partilhe a página do evento", href: `${base}/registrations`, permission: "view" },
    { done: stats.paid > 0 && stats.weighed >= stats.paid, label: "Fazer a pesagem", hint: `${stats.weighed} de ${stats.paid} atletas pesados`, href: `${base}/weigh-in`, permission: "floor" },
    { done: stats.divisions > 0 && stats.brackets >= stats.divisions, label: "Gerar as chaves", hint: `${stats.brackets} de ${stats.divisions} categorias`, href: `${base}/brackets`, permission: "event" },
    { done: stats.scheduled > 0, label: "Programar as lutas", hint: "Áreas e horas de início", href: `${base}/schedule`, permission: "event" },
    { done: stats.mats > 0, label: "Preparar as áreas de luta", hint: "Um placar por tatami", href: `${base}/scoreboard`, permission: "floor" },
    { done: stats.liveMats > 0, label: "Iniciar a transmissão", hint: "YouTube ou Facebook", href: `${base}/streaming`, permission: "floor" },
  ];

  return (
    <>
      <SectionHeader title="Visão geral" description="O estado do evento num relance. Cada cartão leva à secção respetiva." />

      <div className="mb-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <StatTile
          icon="users"
          tone="primary"
          label="Inscrições confirmadas"
          value={stats.paid}
          hint={`${stats.incomplete} por pagar · ${stats.cancelled} canceladas`}
          href={`${base}/registrations`}
        />
        {can("money") && (
          <StatTile
            icon="wallet"
            tone="success"
            label="Receita líquida"
            value={formatMoney(stats.netCents, event.currency)}
            hint={stats.refundedCents > 0 ? `${formatMoney(stats.refundedCents, event.currency)} reembolsados` : "Sem reembolsos"}
            href={`${base}/payments`}
          />
        )}
        {can("event") && (
          <StatTile
            icon="ticket"
            label="Cupões ativos"
            value={stats.coupons}
            hint={event.earlyDiscountPercent ? `Desconto antecipado de ${event.earlyDiscountPercent}%` : "Sem desconto antecipado"}
            href={`${base}/discounts`}
          />
        )}
        <StatTile
          icon="scale"
          tone={stats.paid > 0 && stats.weighed >= stats.paid ? "success" : "warning"}
          label="Pesagem"
          value={`${stats.weighed}/${stats.paid}`}
          hint="Atletas confirmados já pesados"
          href={`${base}/weigh-in`}
        />
        <StatTile
          icon="bracket"
          label="Chaves geradas"
          value={`${stats.brackets}/${stats.divisions}`}
          hint="Categorias com chave"
          href={`${base}/brackets`}
        />
        <StatTile
          icon="video"
          tone={stats.liveMats > 0 ? "danger" : "neutral"}
          label="Áreas em direto"
          value={`${stats.liveMats}/${stats.mats}`}
          hint={`${stats.busyMats} com luta no placar`}
          href={`${base}/streaming`}
        />
      </div>

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <section>
          <div className="mb-3 flex items-end justify-between">
            <h3 className="font-display text-xl font-bold uppercase leading-none">Últimas inscrições</h3>
            <Link href={`${base}/registrations`} className="text-sm font-semibold text-primary hover:underline">
              Ver todas
            </Link>
          </div>
          {stats.recent.length === 0 ? (
            <Empty>Ainda não há inscrições.</Empty>
          ) : (
            <Card className="divide-y divide-line">
              {stats.recent.map((registration) => (
                <div key={registration.id} className="flex items-center gap-3 px-4 py-3 text-sm">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">
                      {registration.athlete.firstName} {registration.athlete.lastName}
                    </p>
                    <p className="truncate text-xs text-muted">
                      {registration.division.name}
                      {registration.athlete.academy && ` · ${registration.athlete.academy.name}`}
                    </p>
                  </div>
                  <RegistrationStatusBadge status={registration.status} />
                </div>
              ))}
            </Card>
          )}
        </section>
        <Checklist steps={steps.filter((step) => can(step.permission))} />
      </div>
    </>
  );
}

export default function EventOverviewPage({ params }: PageProps<"/manage/events/[eventId]">) {
  return (
    <Suspense fallback={<p className="text-sm text-muted">A carregar…</p>}>
      <Overview params={params} />
    </Suspense>
  );
}
