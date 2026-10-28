import Link from "next/link";
import { Suspense } from "react";
import { NoAccess, Notice, SectionHeader, StatTile } from "@/components/manage/parts";
import { Card, LinkButton } from "@/components/ui";
import { count } from "@/lib/format";
import { canOrganizer } from "@/lib/organizer-permissions";
import { requireUser } from "@/server/auth";
import { getEventCredits } from "@/server/credits";
import { getEventWorkspace } from "@/server/organizer";
import { describeAccount, getPaymentAccount } from "@/server/payment-accounts";

async function Credits({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  const user = await requireUser();
  const event = await getEventWorkspace(user.id, eventId);
  if (!event) return null;
  if (!canOrganizer(event.role, "money")) return <NoAccess />;
  const [credits, account] = await Promise.all([getEventCredits(event.id), getPaymentAccount({ organizerId: event.organizerId })]);
  const view = describeAccount(account);
  const receives = view.proxypay.configured || view.paypal.configured;
  const base = `/manage/organizers/${event.organizerId}`;

  return (
    <>
      <SectionHeader
        title="Créditos"
        description="Cada atleta confirmado neste evento gasta 1 crédito da organização, uma só vez, seja em quantas categorias for. Os atletas não pagam taxas à Camps e o valor das inscrições cai direto na conta de pagamentos da organização."
      />

      {credits.due > 0 && (
        <div className="mb-6">
          <Notice tone="danger">
            Faltam <strong>{count(credits.due, "crédito", "créditos")}</strong>. As inscrições continuam a entrar, mas gerar chaves,
            programar e chamar lutas ao placar fica bloqueado até comprar os créditos em falta.
          </Notice>
        </div>
      )}

      <div className="mb-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile icon="users" tone="primary" label="Atletas confirmados" value={credits.athletes} />
        <StatTile icon="check" label="Créditos gastos" value={credits.charged} hint="Neste evento" />
        <StatTile icon="alert" tone={credits.due > 0 ? "danger" : "neutral"} label="Por cobrar" value={credits.due} />
        <StatTile icon="wallet" tone="success" label="Saldo da organização" value={credits.organizer.credits} hint={credits.organizer.name} />
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-2">
        <Card className="p-5">
          <h3 className="mb-1 font-display text-xl font-bold uppercase leading-none">Comprar créditos</h3>
          <p className="mb-4 text-sm text-muted">
            Os créditos são da organização e servem para todos os eventos dela. Pacotes maiores saem mais baratos por atleta.
          </p>
          <LinkButton href={`${base}/credits`}>{credits.due > 0 ? "Comprar os créditos em falta" : "Ver saldo e comprar"}</LinkButton>
        </Card>
        <Card className="p-5">
          <h3 className="mb-1 font-display text-xl font-bold uppercase leading-none">Receber as inscrições</h3>
          {receives ? (
            <p className="text-sm text-muted">
              A organização tem {[view.proxypay.configured && "Multicaixa Express", view.paypal.configured && "PayPal"].filter(Boolean).join(" e ")} ligado:
              as inscrições pagas caem direto nessa conta.
            </p>
          ) : (
            <p className="text-sm text-muted">
              A organização ainda não ligou uma conta: as categorias pagas não aceitam inscrições online.
            </p>
          )}
          {canOrganizer(event.role, "payout") ? (
            <Link href={`${base}/payments`} className="mt-3 inline-block text-sm font-semibold text-primary hover:underline">
              {receives ? "Gerir a conta de pagamentos" : "Ligar a conta de pagamentos"}
            </Link>
          ) : (
            !receives && <p className="mt-3 text-sm text-muted">Só o dono da organização a pode ligar.</p>
          )}
        </Card>
      </div>
    </>
  );
}

export default function EventCreditsPage({ params }: PageProps<"/manage/events/[eventId]/credits">) {
  return (
    <Suspense fallback={<p className="text-sm text-muted">A carregar…</p>}>
      <Credits params={params} />
    </Suspense>
  );
}
