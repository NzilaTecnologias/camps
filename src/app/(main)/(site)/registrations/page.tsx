import Link from "next/link";
import { Suspense } from "react";
import { RegistrationStatusBadge } from "@/components/status-badges";
import { Avatar, Empty, Icon, LinkButton, PageTitle, RowList } from "@/components/ui";
import { formatDate } from "@/lib/format";
import { requireUser } from "@/server/auth";
import { listMyRegistrations } from "@/server/registrations";

async function RegistrationList() {
  const user = await requireUser();
  const registrations = await listMyRegistrations(user.id);
  if (registrations.length === 0) {
    return (
      <Empty>
        <p className="mb-4">Ainda não tem inscrições.</p>
        <LinkButton href="/events">Ver eventos</LinkButton>
      </Empty>
    );
  }
  return (
    <RowList>
      {registrations.map((registration) => {
        const name = `${registration.athlete.firstName} ${registration.athlete.lastName}`;
        return (
          <Link
            key={registration.id}
            href={`/registrations/${registration.id}`}
            className="group flex items-center gap-4 px-5 py-4 transition-colors hover:bg-surface-2"
          >
            <Avatar name={name} />
            <div className="min-w-0 flex-1">
              <p className="font-semibold group-hover:text-primary">{name}</p>
              <p className="mt-0.5 truncate text-sm text-muted">
                {registration.division.event.name} · {registration.division.name} ·{" "}
                {formatDate(registration.division.event.startsAt)}
              </p>
            </div>
            <RegistrationStatusBadge status={registration.status} />
            <Icon name="chevron-right" className="h-5 w-5 text-muted group-hover:text-primary" />
          </Link>
        );
      })}
    </RowList>
  );
}

export default function RegistrationsPage() {
  return (
    <>
      <header className="mb-8 border-b border-line pb-6">
        <PageTitle>As minhas inscrições</PageTitle>
      </header>
      <Suspense fallback={<p className="text-sm text-muted">A carregar…</p>}>
        <RegistrationList />
      </Suspense>
    </>
  );
}
