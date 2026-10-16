import { connection } from "next/server";
import { Suspense } from "react";
import { ActionForm } from "@/components/action-form";
import { Field, SelectField } from "@/components/field";
import { DataTable, Notice, SectionHeader } from "@/components/manage/parts";
import { Badge, Card, Empty, buttonClass } from "@/components/ui";
import { formatDate, formatMoney, toDateInput } from "@/lib/format";
import { earlyDiscountActive } from "@/lib/pricing";
import { requireUser } from "@/server/auth";
import { listCoupons } from "@/server/coupons";
import { getEventWorkspace } from "@/server/organizer";
import {
  createCouponAction,
  deleteCouponAction,
  setCouponActiveAction,
  setEarlyDiscountAction,
} from "../../../event-actions";

async function Discounts({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  const user = await requireUser();
  const [event, coupons] = await Promise.all([getEventWorkspace(user.id, eventId), listCoupons(user.id, eventId)]);
  if (!event) return null;
  await connection();
  const now = new Date();
  const earlyOn = earlyDiscountActive(event, now);

  return (
    <>
      <SectionHeader
        title="Descontos e cupões"
        description="O desconto antecipado aplica-se sozinho a quem se inscreve até uma data. Os cupões são códigos que o atleta escreve na inscrição. Os dois acumulam: primeiro o antecipado, depois o cupão."
      />

      <section className="mb-10">
        <Card className="p-6">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h3 className="font-display text-xl font-bold uppercase leading-none">Desconto antecipado</h3>
            {event.earlyDiscountPercent ? (
              <Badge tone={earlyOn ? "success" : "neutral"}>
                {earlyOn
                  ? `${event.earlyDiscountPercent}% até ${formatDate(event.earlyDiscountEndsAt!)}`
                  : `Terminou a ${formatDate(event.earlyDiscountEndsAt!)}`}
              </Badge>
            ) : (
              <Badge>Desligado</Badge>
            )}
          </div>
          <ActionForm
            action={setEarlyDiscountAction.bind(null, event.id)}
            submitLabel="Guardar desconto"
            submitVariant="secondary"
            className="grid items-end gap-4 sm:grid-cols-[10rem_14rem_auto]"
          >
            <Field
              label="Percentagem"
              name="percent"
              type="number"
              min={0}
              max={100}
              defaultValue={event.earlyDiscountPercent ?? ""}
              placeholder="0 = desligado"
            />
            <Field
              label="Válido até (inclusive)"
              name="endsOn"
              type="date"
              defaultValue={toDateInput(event.earlyDiscountEndsAt)}
              max={toDateInput(event.registrationClosesAt)}
            />
          </ActionForm>
        </Card>
      </section>

      <section className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <div>
          <h3 className="mb-3 font-display text-xl font-bold uppercase leading-none">Cupões</h3>
          {coupons.length === 0 ? (
            <Empty>Ainda não há cupões. Crie o primeiro no formulário.</Empty>
          ) : (
            <DataTable head={["Código", "Desconto", "Usos", "Validade", "Estado", ""]}>
              {coupons.map((coupon) => {
                const uses = coupon._count.registrations;
                const expired = coupon.expiresAt !== null && now > coupon.expiresAt;
                const exhausted = coupon.maxUses !== null && uses >= coupon.maxUses;
                return (
                  <tr key={coupon.id} className="transition-colors hover:bg-surface-2">
                    <td className="px-4 py-3">
                      <code className="rounded bg-foreground/8 px-2 py-1 font-mono text-sm font-semibold">{coupon.code}</code>
                    </td>
                    <td className="px-4 py-3 font-semibold">
                      {coupon.percentOff ? `${coupon.percentOff}%` : formatMoney(coupon.amountOffCents ?? 0, event.currency)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 tabular-nums">
                      {uses}
                      {coupon.maxUses !== null && <span className="text-muted"> / {coupon.maxUses}</span>}
                    </td>
                    <td className="px-4 py-3 text-muted">{coupon.expiresAt ? formatDate(coupon.expiresAt) : "Sem validade"}</td>
                    <td className="px-4 py-3">
                      {!coupon.active ? (
                        <Badge>Desativado</Badge>
                      ) : expired ? (
                        <Badge tone="warning">Expirado</Badge>
                      ) : exhausted ? (
                        <Badge tone="warning">Esgotado</Badge>
                      ) : (
                        <Badge tone="success">Ativo</Badge>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-2">
                        <ActionForm action={setCouponActiveAction.bind(null, coupon.id, !coupon.active)}>
                          <button type="submit" className={buttonClass("secondary", "sm")}>
                            {coupon.active ? "Desativar" : "Ativar"}
                          </button>
                        </ActionForm>
                        {uses === 0 && (
                          <ActionForm action={deleteCouponAction.bind(null, coupon.id)}>
                            <button type="submit" className={buttonClass("ghost", "sm")}>
                              Apagar
                            </button>
                          </ActionForm>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </DataTable>
          )}
          <div className="mt-4">
            <Notice>
              Um cupão conta como usado quando a inscrição fica paga. Cupões já usados não se apagam: desative-os para
              deixarem de valer.
            </Notice>
          </div>
        </div>

        <Card className="p-5">
          <h3 className="mb-4 font-display text-xl font-bold uppercase leading-none">Novo cupão</h3>
          <ActionForm action={createCouponAction.bind(null, event.id)} submitLabel="Criar cupão" className="flex flex-col gap-4">
            <Field label="Código" name="code" placeholder="ACADEMIA10" maxLength={30} autoComplete="off" required />
            <div className="grid grid-cols-2 gap-4">
              <SelectField label="Tipo" name="kind" defaultValue="percent">
                <option value="percent">Percentagem</option>
                <option value="amount">Valor fixo ({event.currency})</option>
              </SelectField>
              <Field label="Desconto" name="value" inputMode="decimal" placeholder="10" required />
            </div>
            <Field label="Máximo de usos (vazio = sem limite)" name="maxUses" type="number" min={1} />
            <Field label="Válido até (vazio = sem validade)" name="expiresOn" type="date" />
          </ActionForm>
        </Card>
      </section>
    </>
  );
}

export default function DiscountsPage({ params }: PageProps<"/manage/events/[eventId]/discounts">) {
  return (
    <Suspense fallback={<p className="text-sm text-muted">A carregar…</p>}>
      <Discounts params={params} />
    </Suspense>
  );
}
