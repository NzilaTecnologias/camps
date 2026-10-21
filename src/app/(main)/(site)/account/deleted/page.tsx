import type { Metadata } from "next";
import { Card, LinkButton } from "@/components/ui";

export const metadata: Metadata = { title: "Conta eliminada — Camps", robots: { index: false } };

export default function AccountDeletedPage() {
  return (
    <div className="mx-auto max-w-md py-8">
      <Card className="p-7">
        <h1 className="font-display text-4xl font-bold uppercase leading-none">Conta eliminada</h1>
        <p className="mt-3 text-sm text-muted">
          Os seus dados pessoais foram apagados e a conta já não pode ser usada. Os registos que a lei obriga a guardar
          (pagamentos) e os resultados de competições já disputadas ficam no histórico, sem ligação a esta conta.
        </p>
        <LinkButton href="/" className="mt-6">
          Voltar ao início
        </LinkButton>
      </Card>
    </div>
  );
}
