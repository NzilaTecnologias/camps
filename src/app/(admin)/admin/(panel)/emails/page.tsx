import { Suspense } from "react";
import { ActionForm } from "@/components/action-form";
import { AdminHeader, textOf } from "@/components/admin/parts";
import { DataTable, FilterTabs } from "@/components/manage/parts";
import { Badge, Empty } from "@/components/ui";
import { formatDateTime } from "@/lib/format";
import { listEmails } from "@/server/admin/data";
import { pageStaff } from "@/server/admin/session";
import { retryEmailAction } from "../../actions";

const TABS = [
  { value: "", label: "Todos" },
  { value: "failed", label: "Falhados" },
  { value: "pending", label: "Na fila" },
  { value: "sent", label: "Enviados" },
];

async function Emails({ searchParams }: { searchParams: PageProps<"/admin/emails">["searchParams"] }) {
  const staff = await pageStaff("emails");
  const status = textOf((await searchParams).status);
  const emails = await listEmails(staff, status);
  return (
    <>
      <AdminHeader
        title="E-mails"
        description="A fila de e-mails da plataforma (os 200 mais recentes). Os que falharam 6 vezes ficam parados; pode voltar a pô-los na fila depois de corrigir a causa (chave da Resend, domínio, endereço)."
      />
      <FilterTabs tabs={TABS.map((tab) => ({ href: tab.value ? `/admin/emails?status=${tab.value}` : "/admin/emails", label: tab.label, active: status === tab.value }))} />
      {emails.length === 0 ? (
        <Empty>Nenhum e-mail.</Empty>
      ) : (
        <DataTable head={["Criado", "Para", "Assunto", "Estado", ""]}>
          {emails.map((email) => (
            <tr key={email.id} className="align-top">
              <td className="px-4 py-3 text-muted">{formatDateTime(email.createdAt)}</td>
              <td className="px-4 py-3">{email.to}</td>
              <td className="px-4 py-3">{email.subject}</td>
              <td className="px-4 py-3">
                {email.sentAt ? (
                  <Badge tone="success">Enviado {formatDateTime(email.sentAt)}</Badge>
                ) : email.nextAttemptAt ? (
                  <Badge tone="warning">Na fila ({email.attempts} tentativas)</Badge>
                ) : (
                  <Badge tone="danger">Falhou ({email.attempts} tentativas)</Badge>
                )}
                {email.lastError && !email.sentAt && <p className="mt-1 max-w-64 break-words text-xs text-muted">{email.lastError}</p>}
              </td>
              <td className="px-4 py-3 text-right">
                {!email.sentAt && !email.nextAttemptAt && (
                  <ActionForm action={retryEmailAction.bind(null, email.id)} submitLabel="Tentar de novo" submitVariant="secondary">
                    {null}
                  </ActionForm>
                )}
              </td>
            </tr>
          ))}
        </DataTable>
      )}
    </>
  );
}

export default function AdminEmailsPage({ searchParams }: PageProps<"/admin/emails">) {
  return (
    <Suspense fallback={<p className="text-sm text-muted">A carregar…</p>}>
      <Emails searchParams={searchParams} />
    </Suspense>
  );
}
