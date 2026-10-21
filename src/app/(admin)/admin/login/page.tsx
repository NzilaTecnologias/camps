import { ActionForm } from "@/components/action-form";
import { Field } from "@/components/field";
import { Card } from "@/components/ui";
import { adminLogInAction } from "../actions";

// Entrada da administração, separada do login do site. Só entra quem é da equipa da Camps.
export default function AdminLoginPage() {
  return (
    <div className="flex flex-1 items-center justify-center px-4 py-16">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-md bg-primary font-display text-xl font-bold text-white">C</span>
          <span className="flex flex-col">
            <span className="font-display text-2xl font-bold uppercase leading-none tracking-wide">Camps</span>
            <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-accent">Administração</span>
          </span>
        </div>
        <Card className="p-7">
          <h1 className="font-display text-3xl font-bold uppercase leading-none">Entrar na administração</h1>
          <p className="mt-2 mb-6 text-sm text-muted">
            Acesso reservado à equipa da Camps. Cada entrada fica registada; a sessão termina ao fim de 8 horas.
          </p>
          <ActionForm action={adminLogInAction} submitLabel="Entrar" className="flex flex-col gap-4">
            <Field label="E-mail" name="email" type="email" autoComplete="username" required />
            <Field label="Palavra-passe" name="password" type="password" autoComplete="current-password" required />
          </ActionForm>
        </Card>
      </div>
    </div>
  );
}
