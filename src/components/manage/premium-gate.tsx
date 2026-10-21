import type { ReactNode } from "react";
import { Notice } from "./parts";

/** Mostra o conteúdo só com o plano pedido; caso contrário explica o que falta. */
export function PlanGate({ allowed, plan, children }: { allowed: boolean; plan: "ativo" | "Premium"; children: ReactNode }) {
  if (allowed) return <>{children}</>;
  return (
    <Notice>
      {plan === "Premium"
        ? "Esta secção faz parte do plano Premium. Pode mudar de plano em Plano e faturas."
        : "Esta secção precisa de um plano ativo. Pode pagá-lo online em Plano e faturas."}
    </Notice>
  );
}
