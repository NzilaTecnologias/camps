"use client";

import { useActionState, type ReactNode } from "react";
import type { FormAction } from "@/lib/action-state";

type Props = {
  action: FormAction;
  children: ReactNode;
  /** Sem rótulo, o formulário não ganha botão próprio: os filhos trazem os seus. */
  submitLabel?: string;
  className?: string;
};

export function ActionForm({ action, children, submitLabel, className }: Props) {
  const [state, formAction, pending] = useActionState(action, {});

  return (
    <form action={formAction} className={className}>
      <fieldset disabled={pending} className="contents">
        {children}
        {submitLabel && (
          <button
            type="submit"
            className="rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background disabled:opacity-50"
          >
            {pending ? "A enviar…" : submitLabel}
          </button>
        )}
      </fieldset>
      {state.error && (
        <p role="alert" className="text-sm text-red-600">
          {state.error}
        </p>
      )}
    </form>
  );
}
