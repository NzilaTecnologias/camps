import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { Card, Empty, PageTitle } from "@/components/ui";
import { prisma } from "@/lib/db";
import { formatDateTime } from "@/lib/format";
import { devMailboxEnabled } from "@/server/email";

export const metadata: Metadata = { title: "Caixa de correio de desenvolvimento — Camps", robots: { index: false } };

/** Os links dentro do texto, para se poderem abrir com um clique. */
function linksIn(text: string) {
  return Array.from(new Set(text.match(/https?:\/\/\S+/g) ?? []));
}

async function Mailbox({ searchParams }: { searchParams: PageProps<"/dev/mailbox">["searchParams"] }) {
  await connection();
  // Sem Resend e fora de produção, os e-mails ficam aqui em vez de saírem.
  if (!devMailboxEnabled()) notFound();
  const { to } = await searchParams;
  const emails = await prisma.emailOutbox.findMany({
    where: typeof to === "string" && to ? { to: to.toLowerCase() } : {},
    orderBy: { createdAt: "desc" },
    take: 30,
  });
  if (emails.length === 0) return <Empty>Ainda não foi enviado nenhum e-mail.</Empty>;
  return (
    <div className="space-y-4">
      {emails.map((email) => (
        <Card key={email.id} className="p-5">
          <p className="text-xs text-muted">
            {formatDateTime(email.createdAt)} · para <strong className="text-foreground">{email.to}</strong>
          </p>
          <h2 className="mt-1 font-semibold">{email.subject}</h2>
          <ul className="mt-2 space-y-1 text-sm">
            {linksIn(email.text).map((link) => (
              <li key={link}>
                <a href={link} className="break-all font-semibold text-primary hover:underline" data-mail-link>
                  {link}
                </a>
              </li>
            ))}
          </ul>
          <details className="mt-2">
            <summary className="cursor-pointer text-xs text-muted">Texto completo</summary>
            <pre className="mt-2 whitespace-pre-wrap text-xs">{email.text}</pre>
          </details>
        </Card>
      ))}
    </div>
  );
}

export default function DevMailboxPage({ searchParams }: PageProps<"/dev/mailbox">) {
  // Em produção a página inteira é um 404 (decidido já na build, porque NODE_ENV não muda).
  if (process.env.NODE_ENV === "production") notFound();
  return (
    <>
      <PageTitle>Caixa de correio (desenvolvimento)</PageTitle>
      <p className="mt-2 mb-6 text-sm text-muted">
        Sem RESEND_API_KEY, os e-mails não saem: ficam aqui. Esta página não existe em produção.
      </p>
      <Suspense fallback={<p className="text-sm text-muted">A carregar…</p>}>
        <Mailbox searchParams={searchParams} />
      </Suspense>
    </>
  );
}
