"use client";

import { useActionState } from "react";
import { resendVerificationAction } from "@/app/(main)/(site)/(auth)/actions";

export function ResendVerification() {
  const [state, action, pending] = useActionState(resendVerificationAction, {});
  if (state.sent) return <span className="font-semibold">Enviado. Veja a caixa de entrada (e o spam).</span>;
  return (
    <form action={action} className="inline">
      <button type="submit" disabled={pending} className="font-semibold underline underline-offset-2 hover:no-underline disabled:opacity-60">
        {pending ? "A enviar…" : "Reenviar"}
      </button>
      {state.error && <span className="ml-2">{state.error}</span>}
    </form>
  );
}
