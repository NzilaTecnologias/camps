// Extrato de um evento entre a Camps e o organizador. As inscrições pagas online entram na conta
// da Camps; a Camps fica com a taxa por atleta e transfere o resto ao organizador.

export type StatementInput = {
  /** Pagamentos online concluídos (incluindo os que depois foram reembolsados). */
  collectedCents: number;
  /** Desses, quanto já foi devolvido aos atletas. */
  refundedCents: number;
  /** Atletas diferentes que chegaram a ter inscrição confirmada no evento. */
  athletes: number;
  feePerAthleteCents: number;
  /** Transferências já feitas para o organizador. */
  paidOutCents: number;
};

export type Statement = StatementInput & {
  netCollectedCents: number;
  feeCents: number;
  /** Positivo: a Camps deve transferir ao organizador. Negativo: o organizador deve à Camps. */
  balanceCents: number;
};

export function computeStatement(input: StatementInput): Statement {
  const netCollectedCents = input.collectedCents - input.refundedCents;
  const feeCents = input.athletes * input.feePerAthleteCents;
  return {
    ...input,
    netCollectedCents,
    feeCents,
    balanceCents: netCollectedCents - feeCents - input.paidOutCents,
  };
}

/** IBAN angolano: "AO06" + 21 dígitos. Aceita espaços e minúsculas; devolve-o normalizado ou null. */
export function normalizeAngolanIban(value: string): string | null {
  const iban = value.replace(/\s+/g, "").toUpperCase();
  if (!/^AO\d{23}$/.test(iban)) return null;
  // Verificação mod 97 (ISO 13616): passar as 4 primeiras posições para o fim, letras para números.
  const rearranged = iban.slice(4) + iban.slice(0, 4);
  const digits = rearranged.replace(/[A-Z]/g, (letter) => String(letter.charCodeAt(0) - 55));
  let remainder = 0;
  for (const digit of digits) remainder = (remainder * 10 + Number(digit)) % 97;
  return remainder === 1 ? iban : null;
}

/** "AO06 0040 0000 1234 5678 1017 4" para mostrar. */
export function formatIban(iban: string): string {
  return iban.replace(/(.{4})/g, "$1 ").trim();
}
