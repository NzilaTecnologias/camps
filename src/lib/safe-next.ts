/**
 * Destino depois do login. Só aceita caminhos internos: um `next` vindo do URL
 * não pode mandar o utilizador para outro site ("//site.com", "/\site.com", "/<tab>/site.com").
 */
export function safeNext(value: string, fallback = "/"): string {
  // O navegador apaga tabs e quebras de linha dos URLs, por isso "/\t/site.com" vira "//site.com".
  if (!value.startsWith("/") || /[\u0000-\u001f\u007f\\]/.test(value)) return fallback;
  const base = "http://camps.invalid";
  try {
    return new URL(value, base).origin === base ? value : fallback;
  } catch {
    return fallback;
  }
}
