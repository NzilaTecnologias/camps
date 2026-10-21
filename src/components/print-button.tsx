"use client";

import { buttonClass } from "./ui";

/** Abre a janela de impressão do navegador, onde também se guarda em PDF. */
export function PrintButton({ label = "Imprimir / guardar PDF" }: { label?: string }) {
  return (
    <button type="button" onClick={() => window.print()} className={`${buttonClass("primary")} print:hidden`}>
      {label}
    </button>
  );
}
