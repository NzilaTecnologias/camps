/**
 * Destino depois do login. Só aceita caminhos internos: um `next` vindo do URL
 * não pode mandar o utilizador para outro site ("//site.com", "/\site.com").
 */
export function safeNext(value: string, fallback = "/"): string {
  const isInternal = value.startsWith("/") && !value.startsWith("//") && !value.includes("\\");
  return isInternal ? value : fallback;
}
