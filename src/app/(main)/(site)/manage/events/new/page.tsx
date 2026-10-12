import Link from "next/link";
import { Suspense } from "react";
import { ActionForm } from "@/components/action-form";
import { Field, SelectField } from "@/components/field";
import { BackLink, Card, Empty, PageTitle } from "@/components/ui";
import { requireUser } from "@/server/auth";
import { listOrganizers } from "@/server/manage";
import { createEventAction } from "../../actions";

async function NewEventForm() {
  const user = await requireUser();
  const organizers = await listOrganizers(user.id);
  if (organizers.length === 0) {
    return (
      <Empty>
        Crie uma organização no{" "}
        <Link href="/manage" className="font-semibold text-primary hover:underline">
          painel
        </Link>{" "}
        antes de criar um evento.
      </Empty>
    );
  }

  return (
    <Card className="max-w-2xl p-6">
      <ActionForm action={createEventAction} submitLabel="Criar evento" className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <SelectField label="Organização" name="organizerId" required>
            {organizers.map((organizer) => (
              <option key={organizer.id} value={organizer.id}>
                {organizer.name}
              </option>
            ))}
          </SelectField>
        </div>
        <div className="sm:col-span-2">
          <Field label="Nome do evento" name="name" required />
        </div>
        <Field label="Data do evento" name="date" type="date" required />
        <Field label="Inscrições até" name="registrationClosesOn" type="date" required />
        <Field label="Local" name="venue" placeholder="Pavilhão, ginásio…" />
        <Field label="Cidade" name="city" placeholder="Luanda" />
        <div className="sm:col-span-2">
          <Field label="Descrição" name="description" />
        </div>
      </ActionForm>
    </Card>
  );
}

export default function NewEventPage() {
  return (
    <>
      <BackLink href="/manage">Painel</BackLink>
      <header className="mt-3 mb-8">
        <PageTitle>Novo evento</PageTitle>
        <p className="mt-2 text-sm text-muted">O evento nasce como rascunho; só fica visível depois de publicado.</p>
      </header>
      <Suspense fallback={<p className="text-sm text-muted">A carregar…</p>}>
        <NewEventForm />
      </Suspense>
    </>
  );
}
