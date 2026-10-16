import { prisma } from "@/lib/db";
import { UserError } from "@/lib/errors";
import { UTC_OFFSET } from "@/lib/format";
import { COUPON_CODE, normalizeCouponCode } from "@/lib/pricing";
import { memberOf } from "./manage";

/** Usos de um cupão: inscrições pagas que o aplicaram. */
const usesCount = { _count: { select: { registrations: { where: { status: "PAID" as const } } } } };

/** Cupão que um atleta pode usar agora neste evento; recusa com uma mensagem clara se não puder. */
export async function findUsableCoupon(eventId: string, rawCode: string, now = new Date()) {
  const code = normalizeCouponCode(rawCode);
  const coupon = await prisma.coupon.findUnique({
    where: { eventId_code: { eventId, code } },
    include: usesCount,
  });
  if (!coupon || !coupon.active) throw new UserError(`O cupão ${code} não existe ou já não está ativo`);
  if (coupon.expiresAt && now > coupon.expiresAt) throw new UserError(`O cupão ${code} expirou`);
  if (coupon.maxUses !== null && coupon._count.registrations >= coupon.maxUses) {
    throw new UserError(`O cupão ${code} já foi usado o número máximo de vezes`);
  }
  return coupon;
}

export function listCoupons(userId: string, eventId: string) {
  return prisma.coupon.findMany({
    where: { eventId, event: memberOf(userId) },
    orderBy: [{ active: "desc" }, { createdAt: "desc" }],
    include: usesCount,
  });
}

async function requireEvent(userId: string, eventId: string) {
  const event = await prisma.event.findFirst({ where: { id: eventId, ...memberOf(userId) } });
  if (!event) throw new UserError("Evento não encontrado");
  return event;
}

const parseAmount = (value: string) => Number(value.replace(/\s/g, "").replace(",", "."));

export type CouponInput = { code: string; kind: string; value: string; maxUses: string; expiresOn: string };

export async function createCoupon(userId: string, eventId: string, input: CouponInput) {
  const event = await requireEvent(userId, eventId);
  const code = normalizeCouponCode(input.code);
  if (!COUPON_CODE.test(code)) {
    throw new UserError("O código precisa de 3 a 30 caracteres: letras, números ou hífen");
  }

  const value = parseAmount(input.value);
  let percentOff: number | null = null;
  let amountOffCents: number | null = null;
  if (input.kind === "percent") {
    if (!Number.isInteger(value) || value < 1 || value > 100) throw new UserError("A percentagem vai de 1 a 100");
    percentOff = value;
  } else if (input.kind === "amount") {
    if (!(value > 0 && value < 100_000_000)) throw new UserError("Valor do desconto inválido");
    amountOffCents = Math.round(value * 100);
  } else {
    throw new UserError("Escolha o tipo de desconto");
  }

  const maxUses = input.maxUses ? Number(input.maxUses) : null;
  if (maxUses !== null && !(Number.isInteger(maxUses) && maxUses > 0 && maxUses <= 100_000)) {
    throw new UserError("Número máximo de usos inválido");
  }
  let expiresAt: Date | null = null;
  if (input.expiresOn) {
    expiresAt = /^\d{4}-\d{2}-\d{2}$/.test(input.expiresOn) ? new Date(`${input.expiresOn}T23:59:59${UTC_OFFSET}`) : new Date(NaN);
    if (Number.isNaN(expiresAt.getTime())) throw new UserError("Data de validade inválida");
  }

  if (await prisma.coupon.findUnique({ where: { eventId_code: { eventId: event.id, code } } })) {
    throw new UserError(`Já existe o cupão ${code} neste evento`);
  }
  await prisma.coupon.create({
    data: { eventId: event.id, code, percentOff, amountOffCents, maxUses, expiresAt },
  });
}

async function requireCoupon(userId: string, couponId: string) {
  const coupon = await prisma.coupon.findFirst({ where: { id: couponId, event: memberOf(userId) }, include: usesCount });
  if (!coupon) throw new UserError("Cupão não encontrado");
  return coupon;
}

export async function setCouponActive(userId: string, couponId: string, active: boolean) {
  const coupon = await requireCoupon(userId, couponId);
  await prisma.coupon.update({ where: { id: coupon.id }, data: { active } });
}

/** Só se apaga um cupão que nunca foi aplicado; os usados ficam no histórico das inscrições. */
export async function deleteCoupon(userId: string, couponId: string) {
  const coupon = await requireCoupon(userId, couponId);
  if ((await prisma.registration.count({ where: { couponId: coupon.id } })) > 0) {
    throw new UserError("Este cupão já foi aplicado em inscrições. Desative-o em vez de o apagar.");
  }
  await prisma.coupon.delete({ where: { id: coupon.id } });
}

/** Desconto automático para quem se inscreve até uma data. Percentagem vazia ou 0 desliga-o. */
export async function setEarlyDiscount(userId: string, eventId: string, percent: string, endsOn: string) {
  const event = await requireEvent(userId, eventId);
  if (!percent || percent === "0") {
    await prisma.event.update({ where: { id: event.id }, data: { earlyDiscountPercent: null, earlyDiscountEndsAt: null } });
    return;
  }
  const value = Number(percent);
  if (!Number.isInteger(value) || value < 1 || value > 100) throw new UserError("A percentagem vai de 1 a 100");
  const endsAt = /^\d{4}-\d{2}-\d{2}$/.test(endsOn) ? new Date(`${endsOn}T23:59:59${UTC_OFFSET}`) : new Date(NaN);
  if (Number.isNaN(endsAt.getTime())) throw new UserError("Indique até quando vale o desconto");
  if (endsAt > event.registrationClosesAt) {
    throw new UserError("O desconto antecipado tem de acabar antes do fim das inscrições");
  }
  await prisma.event.update({
    where: { id: event.id },
    data: { earlyDiscountPercent: value, earlyDiscountEndsAt: endsAt },
  });
}
