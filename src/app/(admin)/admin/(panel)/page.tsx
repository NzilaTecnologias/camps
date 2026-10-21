import Link from "next/link";
import { Suspense } from "react";
import { AdminHeader } from "@/components/admin/parts";
import { DataTable, StatTile } from "@/components/manage/parts";
import { can } from "@/lib/admin-permissions";
import { formatDateTime, formatMoney } from "@/lib/format";
import { dashboard } from "@/server/admin/data";
import { pageStaff } from "@/server/admin/session";

async function Dashboard() {
  const staff = await pageStaff("dashboard");
  const stats = await dashboard(staff);
  return (
    <>
      <AdminHeader title={`Olá, ${staff.name.split(" ")[0]}`} description="Estado da plataforma agora e nos últimos 30 dias." />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile icon="users" tone="primary" label="Utilizadores" value={stats.users} hint={`${stats.newUsers} novos em 30 dias`} href={can(staff.role, "users") ? "/admin/users" : undefined} />
        <StatTile icon="calendar" label="Eventos publicados" value={stats.events} hint={`${stats.upcoming} por acontecer`} href="/admin/events" />
        <StatTile icon="ticket" tone="success" label="Inscrições confirmadas" value={stats.registrations30} hint="Nos últimos 30 dias" />
        <StatTile icon="wallet" tone="success" label="Cobrado online" value={formatMoney(stats.collected30, "AOA")} hint="Inscrições, últimos 30 dias" href="/admin/payments" />
        <StatTile icon="clock" tone={stats.pendingPayments ? "warning" : "neutral"} label="Pagamentos pendentes" value={stats.pendingPayments} hint="À espera do provedor" href="/admin/payments?status=PENDING" />
        <StatTile
          icon="alert"
          tone={stats.failedEmails ? "danger" : "neutral"}
          label="E-mails falhados"
          value={stats.failedEmails}
          hint="Desistiu-se de os enviar"
          href={can(staff.role, "emails") ? "/admin/emails?status=failed" : undefined}
        />
        <StatTile icon="x" tone={stats.suspended ? "warning" : "neutral"} label="Contas suspensas" value={stats.suspended} />
      </div>

      {stats.recent.length > 0 && (
        <section className="mt-10">
          <div className="mb-3 flex items-end justify-between">
            <h2 className="font-display text-xl font-bold uppercase leading-none">Atividade recente da equipa</h2>
            <Link href="/admin/audit" className="text-sm font-semibold text-primary hover:underline">
              Ver tudo
            </Link>
          </div>
          <DataTable head={["Quando", "Quem", "O quê"]}>
            {stats.recent.map((entry) => (
              <tr key={entry.id}>
                <td className="px-4 py-3 text-muted">{formatDateTime(entry.createdAt)}</td>
                <td className="px-4 py-3">{entry.actorEmail}</td>
                <td className="px-4 py-3 font-mono text-xs">{entry.action}</td>
              </tr>
            ))}
          </DataTable>
        </section>
      )}
    </>
  );
}

export default function AdminDashboardPage() {
  return (
    <Suspense fallback={<p className="text-sm text-muted">A carregar…</p>}>
      <Dashboard />
    </Suspense>
  );
}
