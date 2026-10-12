import { UserError } from "./errors";

export type ActionState = { error?: string };

export type FormAction = (state: ActionState, formData: FormData) => Promise<ActionState>;

/**
 * Roda o corpo de uma server action e transforma UserError em mensagem para o formulário.
 * Qualquer outro erro (inclusive os de redirect e notFound do Next) segue adiante.
 */
export async function runAction(body: () => Promise<void>): Promise<ActionState> {
  try {
    await body();
    return {};
  } catch (error) {
    if (error instanceof UserError) return { error: error.message };
    throw error;
  }
}

export function text(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim() : "";
}
