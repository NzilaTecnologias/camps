"use client";

import type { ComponentProps } from "react";

/**
 * Formulário de filtros que se submete sozinho quando muda uma lista ou uma data.
 * A pesquisa por texto continua a precisar de Enter ou do botão, para não recarregar a cada letra.
 */
export function AutoSubmitForm(props: ComponentProps<"form">) {
  return (
    <form
      {...props}
      onChange={(event) => {
        const target = event.target as HTMLElement;
        if (target instanceof HTMLSelectElement || (target instanceof HTMLInputElement && target.type === "date")) {
          event.currentTarget.requestSubmit();
        }
      }}
    />
  );
}
