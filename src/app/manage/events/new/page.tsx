import Link from "next/link";
import { Suspense } from "react";
import { ActionForm } from "@/components/action-form";
import { Field, SelectField } from "@/components/field";
import { requireUser } from "@/server/auth";
import { listOrganizers } from "@/server/manage";
import { createEventAction } from "../../actions";

async function NewEventForm() {
  const user = await requireUser();
  const organizers = await listOrganizers(user.id);
  if (organizers.length === 0) {
    return (
      <p className="opacity-70">
        Crie uma organização no{" "}
        <Link href="/manage" className="underline">
          painel
        </Link>{" "}
        antes de criar um evento.
      </p>
    );
  }

  return (
    <ActionForm action={createEventAction} submitLabel="Criar evento" className="max-w-md space-y-4">
      <SelectField label="Organização" name="organizerId" required>
        {organizers.map((organizer) => (
          <option key={organizer.id} value={organizer.id}>
            {organizer.name}
          </option>
        ))}
      </SelectField>
      <Field label="Nome do evento" name="name" required />
      <Field label="Data do evento" name="date" type="date" required />
      <Field label="Inscrições até" name="registrationClosesOn" type="date" required />
      <Field label="Local" name="venue" />
      <Field label="Cidade" name="city" />
      <Field label="Descrição" name="description" />
    </ActionForm>
  );
}

export default function NewEventPage() {
  return (
    <>
      <Link href="/manage" className="text-sm opacity-60 hover:opacity-100">
        ← Painel
      </Link>
      <h1 className="mb-6 text-2xl font-bold">Novo evento</h1>
      <Suspense fallback={<p className="opacity-60">A carregar…</p>}>
        <NewEventForm />
      </Suspense>
    </>
  );
}
