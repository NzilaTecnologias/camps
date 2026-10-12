import Link from "next/link";
import { Suspense } from "react";
import { REGISTRATION_STATUS_LABEL, formatDate } from "@/lib/format";
import { requireUser } from "@/server/auth";
import { listMyRegistrations } from "@/server/registrations";

async function RegistrationList() {
  const user = await requireUser();
  const registrations = await listMyRegistrations(user.id);
  if (registrations.length === 0) {
    return (
      <p className="opacity-70">
        Ainda não tem inscrições.{" "}
        <Link href="/" className="underline">
          Ver eventos
        </Link>
      </p>
    );
  }
  return (
    <ul className="divide-y divide-foreground/10 rounded-lg border border-foreground/15">
      {registrations.map((registration) => (
        <li key={registration.id}>
          <Link
            href={`/registrations/${registration.id}`}
            className="flex items-center justify-between gap-4 px-4 py-3 hover:bg-foreground/5"
          >
            <span>
              <span className="block font-medium">
                {registration.athlete.firstName} {registration.athlete.lastName}
              </span>
              <span className="text-sm opacity-60">
                {registration.division.event.name} · {registration.division.name} ·{" "}
                {formatDate(registration.division.event.startsAt)}
              </span>
            </span>
            <span className="shrink-0 text-sm opacity-70">{REGISTRATION_STATUS_LABEL[registration.status]}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

export default function RegistrationsPage() {
  return (
    <>
      <h1 className="mb-6 text-2xl font-bold">As minhas inscrições</h1>
      <Suspense fallback={<p className="opacity-60">A carregar…</p>}>
        <RegistrationList />
      </Suspense>
    </>
  );
}
