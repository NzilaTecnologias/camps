import { Suspense } from "react";
import { ActionForm } from "@/components/action-form";
import { AdminHeader } from "@/components/admin/parts";
import { StatTile } from "@/components/manage/parts";
import { Card, Icon } from "@/components/ui";
import { systemStatus } from "@/server/admin/data";
import { pageStaff } from "@/server/admin/session";
import { runJobsAction } from "../../actions";

async function System() {
  const staff = await pageStaff("system");
  const { env, production, counts } = await systemStatus(staff);
  return (
    <>
      <AdminHeader title="Sistema" description="Configuração do servidor e trabalho de fundo (pagamentos pendentes, e-mails, avisos e rankings)." />
      <div className="mb-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <StatTile icon="wallet" tone={counts.pending ? "warning" : "neutral"} label="Pagamentos pendentes" value={counts.pending} />
        <StatTile icon="clock" label="E-mails na fila" value={counts.queuedEmails} />
        <StatTile icon="alert" tone={counts.failedEmails ? "danger" : "neutral"} label="E-mails falhados" value={counts.failedEmails} />
        <StatTile icon="users" label="Sessões no site" value={counts.sessions} />
        <StatTile icon="settings" label="Sessões de administração" value={counts.adminSessions} />
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-2">
        <Card className="p-5">
          <h2 className="mb-1 font-display text-xl font-bold uppercase leading-none">Configuração</h2>
          <p className="mb-4 text-sm text-muted">
            {production
              ? "Conferida a cada arranque do servidor; os erros impedem-no de arrancar."
              : "Servidor de desenvolvimento: a lista mostra o que faltaria em produção."}
          </p>
          {env.errors.length === 0 && env.warnings.length === 0 && (
            <p className="flex items-center gap-2 text-sm text-success">
              <Icon name="check" /> Tudo configurado.
            </p>
          )}
          <ul className="space-y-2 text-sm">
            {env.errors.map((error) => (
              <li key={error} className="flex items-start gap-2 rounded-lg bg-danger/10 px-3 py-2 text-danger">
                <Icon name="x" className="mt-0.5 h-4 w-4" /> {error}
              </li>
            ))}
            {env.warnings.map((warning) => (
              <li key={warning} className="flex items-start gap-2 rounded-lg bg-warning/10 px-3 py-2">
                <Icon name="alert" className="mt-0.5 h-4 w-4 text-warning" /> {warning}
              </li>
            ))}
          </ul>
        </Card>

        <Card className="p-5">
          <h2 className="mb-1 font-display text-xl font-bold uppercase leading-none">Trabalho de fundo</h2>
          <p className="mb-4 text-sm text-muted">
            Corre sozinho de {process.env.JOBS_INTERVAL_SECONDS || "x"} em {process.env.JOBS_INTERVAL_SECONDS || "x"} segundos (ou pelo agendador
            externo). Correr agora consulta os pagamentos pendentes, envia os e-mails e avisos em atraso e recalcula os rankings.
          </p>
          <ActionForm action={runJobsAction} submitLabel="Correr agora" submitVariant="secondary">
            {null}
          </ActionForm>
        </Card>
      </div>
    </>
  );
}

export default function AdminSystemPage() {
  return (
    <Suspense fallback={<p className="text-sm text-muted">A carregar…</p>}>
      <System />
    </Suspense>
  );
}
