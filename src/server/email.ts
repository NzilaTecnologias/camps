import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import type { RenderedEmail } from "@/lib/email-template";

// Envio de e-mails pela Resend (https://resend.com/docs/api-reference/emails/send-email).
// Todos os e-mails passam pela tabela EmailOutbox: são gravados primeiro (dentro da transação do
// que os originou, quando há uma) e enviados logo a seguir; se a Resend falhar, a tarefa de fundo
// volta a tentar. A chave de idempotência é o id da linha, por isso uma nova tentativa nunca
// chega em duplicado à caixa do utilizador.
//
// Sem RESEND_API_KEY, fora de produção, os e-mails ficam só na base de dados e veem-se em
// /dev/mailbox. Em produção, sem a chave, ficam na fila até ela ser configurada.

const RESEND_URL = "https://api.resend.com/emails";
const SEND_TIMEOUT_MS = 10_000;
/** Enquanto um servidor tenta enviar, os outros não pegam no mesmo e-mail. */
const LEASE_MS = 2 * 60 * 1000;
/** Espera antes de cada nova tentativa, em minutos; depois da última, desiste. */
const RETRY_MINUTES = [1, 5, 15, 60, 180, 720];
const BATCH = 50;

type Db = Pick<Prisma.TransactionClient, "emailOutbox">;

export function resendConfigured() {
  return Boolean(process.env.RESEND_API_KEY);
}

/** A caixa de correio de desenvolvimento (/dev/mailbox) só existe sem Resend e fora de produção. */
export function devMailboxEnabled() {
  return !resendConfigured() && process.env.NODE_ENV !== "production";
}

/**
 * Põe um e-mail na fila e devolve o id. `sensitive` marca os e-mails com links de acesso:
 * o conteúdo é apagado da base de dados assim que é enviado.
 */
export async function enqueueEmail(
  db: Db,
  to: string,
  email: RenderedEmail,
  options: { sensitive?: boolean } = {},
): Promise<string> {
  const row = await db.emailOutbox.create({
    data: { to, subject: email.subject, html: email.html, text: email.text, sensitive: options.sensitive ?? false },
    select: { id: true },
  });
  return row.id;
}

type SendResult = { ok: true; providerId: string } | { ok: false; retry: boolean; error: string };

async function sendWithResend(id: string, row: { to: string; subject: string; html: string; text: string }): Promise<SendResult> {
  const from = process.env.EMAIL_FROM;
  if (!from) return { ok: false, retry: true, error: "EMAIL_FROM em falta" };
  try {
    const response = await fetch(RESEND_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
        "Idempotency-Key": `camps-${id}`,
      },
      body: JSON.stringify({
        from,
        to: [row.to],
        subject: row.subject,
        html: row.html,
        text: row.text,
        ...(process.env.EMAIL_REPLY_TO ? { reply_to: process.env.EMAIL_REPLY_TO } : {}),
      }),
      signal: AbortSignal.timeout(SEND_TIMEOUT_MS),
    });
    const body = (await response.json().catch(() => ({}))) as { id?: string; message?: string; name?: string };
    if (response.ok && body.id) return { ok: true, providerId: body.id };
    const error = `Resend ${response.status}: ${body.name ?? ""} ${body.message ?? ""}`.trim();
    // 429 e 5xx são passageiros; os outros 4xx (endereço inválido, domínio não verificado,
    // chave errada) não se resolvem a tentar outra vez… exceto a chave e o domínio, que se
    // corrigem na configuração: esses continuam a ser tentados até ao fim da lista de esperas.
    const permanent = response.status === 422 && !/domain|from/i.test(error);
    return { ok: false, retry: !permanent, error };
  } catch (error) {
    return { ok: false, retry: true, error: error instanceof Error ? error.message : String(error) };
  }
}

/** Tenta enviar um e-mail da fila. Nunca lança: quem chama não deve falhar por causa do e-mail. */
export async function deliverEmail(id: string): Promise<boolean> {
  try {
    const now = new Date();
    const { count } = await prisma.emailOutbox.updateMany({
      where: { id, sentAt: null, nextAttemptAt: { lte: now } },
      data: { nextAttemptAt: new Date(now.getTime() + LEASE_MS), attempts: { increment: 1 } },
    });
    if (count === 0) return false;
    const row = await prisma.emailOutbox.findUniqueOrThrow({ where: { id } });

    if (!resendConfigured()) {
      if (process.env.NODE_ENV === "production") {
        console.error(JSON.stringify({ level: "error", msg: "RESEND_API_KEY em falta: e-mail fica na fila", id }));
        await prisma.emailOutbox.update({
          where: { id },
          data: { attempts: { decrement: 1 }, nextAttemptAt: new Date(now.getTime() + 5 * 60 * 1000), lastError: "RESEND_API_KEY em falta" },
        });
        return false;
      }
      console.log(`[e-mail] para ${row.to}: ${row.subject} (ver /dev/mailbox)`);
      await prisma.emailOutbox.update({ where: { id }, data: { sentAt: now, nextAttemptAt: null, lastError: null } });
      return true;
    }

    const result = await sendWithResend(id, row);
    if (result.ok) {
      await prisma.emailOutbox.update({
        where: { id },
        data: {
          sentAt: new Date(),
          nextAttemptAt: null,
          providerId: result.providerId,
          lastError: null,
          ...(row.sensitive ? { html: "", text: "" } : {}),
        },
      });
      return true;
    }
    const wait = result.retry ? RETRY_MINUTES[row.attempts - 1] : undefined;
    await prisma.emailOutbox.update({
      where: { id },
      data: {
        lastError: result.error.slice(0, 500),
        nextAttemptAt: wait === undefined ? null : new Date(Date.now() + wait * 60 * 1000),
        // Um link de acesso que não chegou a sair não deve ficar guardado.
        ...(wait === undefined && row.sensitive ? { html: "", text: "" } : {}),
      },
    });
    console.error(JSON.stringify({ level: "error", msg: "e-mail não enviado", id, attempt: row.attempts, error: result.error }));
    return false;
  } catch (error) {
    console.error(JSON.stringify({ level: "error", msg: "falha ao enviar e-mail", id, error: String(error) }));
    return false;
  }
}

/** Para a tarefa de fundo: envia o que está em atraso e apaga o histórico antigo. */
export async function deliverPendingEmails(now = new Date()): Promise<number> {
  const due = await prisma.emailOutbox.findMany({
    where: { sentAt: null, nextAttemptAt: { lte: now } },
    orderBy: { nextAttemptAt: "asc" },
    take: BATCH,
    select: { id: true },
  });
  let sent = 0;
  for (const { id } of due) if (await deliverEmail(id)) sent++;
  await prisma.emailOutbox.deleteMany({ where: { createdAt: { lt: new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000) } } });
  return sent;
}
