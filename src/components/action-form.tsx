"use client";

import { useActionState, type ReactNode } from "react";
import type { FormAction } from "@/lib/action-state";
import { buttonClass } from "./ui";

type Props = {
  action: FormAction;
  children: ReactNode;
  /** Sem rótulo, o formulário não ganha botão próprio: os filhos trazem os seus. */
  submitLabel?: string;
  submitVariant?: "primary" | "secondary";
  className?: string;
};

export function ActionForm({ action, children, submitLabel, submitVariant = "primary", className }: Props) {
  const [state, formAction, pending] = useActionState(action, {});

  return (
    <form action={formAction} className={className}>
      <fieldset disabled={pending} className="contents">
        {children}
        {submitLabel && (
          <button type="submit" className={`${buttonClass(submitVariant)} self-start justify-self-start`}>
            {pending ? "A enviar…" : submitLabel}
          </button>
        )}
      </fieldset>
      {state.error && (
        <p role="alert" className="rounded-lg bg-danger/10 px-3 py-2 text-sm font-medium text-danger">
          {state.error}
        </p>
      )}
    </form>
  );
}
