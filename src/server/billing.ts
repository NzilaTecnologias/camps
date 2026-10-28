import { prisma } from "@/lib/db";
import { UserError } from "@/lib/errors";
import { rolesWith } from "@/lib/organizer-permissions";
import { billingDetails, type BillingDetailsInput } from "./invoicing";

// Dados de faturação da organização. A Camps cobra os organizadores em créditos (ver credits.ts):
// as inscrições caem direto na conta de pagamentos da organização, por isso já não há extratos
// nem repasses.

/** Nome, NIF e morada da organização para as faturas dos créditos. */
export async function updateOrganizerBilling(userId: string, organizerId: string, input: BillingDetailsInput) {
  const membership = await prisma.organizerMember.findFirst({
    where: { organizerId, userId, role: { in: rolesWith("payout") } },
  });
  if (!membership) throw new UserError("Só o dono da organização pode mudar os dados de faturação");
  await prisma.organizer.update({ where: { id: organizerId }, data: billingDetails(input) });
}
