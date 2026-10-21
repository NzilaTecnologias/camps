// Modelo único dos e-mails da Camps, em HTML de tabelas (o que os clientes de e-mail entendem)
// e em texto simples. Sem dependências: o conteúdo é escapado aqui.

export type EmailContent = {
  /** Linha de assunto. */
  subject: string;
  /** Título grande no topo do e-mail. */
  heading: string;
  /** Parágrafos antes da tabela de detalhes. */
  paragraphs: string[];
  /** Pares rótulo/valor (atleta, categoria, valor…). */
  rows?: [string, string][];
  action?: { label: string; url: string };
  /** Nota pequena no fim (ex.: "Se não foi você, ignore este e-mail"). */
  footnote?: string;
};

export type RenderedEmail = { subject: string; html: string; text: string };

const PRIMARY = "#d21f2b";
const INK = "#101216";
const MUTED = "#6b7280";

export function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function renderEmail(content: EmailContent): RenderedEmail {
  const { subject, heading, paragraphs, rows = [], action, footnote } = content;
  const font = "font-family:Arial,Helvetica,sans-serif;";

  const htmlParagraphs = paragraphs
    .map((p) => `<p style="${font}margin:0 0 16px;font-size:15px;line-height:1.55;color:${INK}">${escapeHtml(p)}</p>`)
    .join("");
  const htmlRows = rows.length
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:8px 0 20px;border-collapse:collapse">${rows
        .map(
          ([label, value]) =>
            `<tr><td style="${font}padding:8px 0;border-bottom:1px solid #e5e7eb;font-size:13px;color:${MUTED};width:40%">${escapeHtml(label)}</td>` +
            `<td style="${font}padding:8px 0;border-bottom:1px solid #e5e7eb;font-size:14px;color:${INK};font-weight:bold">${escapeHtml(value)}</td></tr>`,
        )
        .join("")}</table>`
    : "";
  const htmlAction = action
    ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0 20px"><tr><td style="border-radius:999px;background:${PRIMARY}">` +
      `<a href="${escapeHtml(action.url)}" style="${font}display:inline-block;padding:12px 24px;font-size:15px;font-weight:bold;color:#ffffff;text-decoration:none;border-radius:999px">${escapeHtml(action.label)}</a>` +
      `</td></tr></table>` +
      `<p style="${font}margin:0 0 16px;font-size:12px;line-height:1.5;color:${MUTED}">Se o botão não funcionar, copie este endereço para o navegador:<br><a href="${escapeHtml(action.url)}" style="color:${PRIMARY};word-break:break-all">${escapeHtml(action.url)}</a></p>`
    : "";
  const htmlFootnote = footnote
    ? `<p style="${font}margin:16px 0 0;font-size:12px;line-height:1.5;color:${MUTED}">${escapeHtml(footnote)}</p>`
    : "";

  const html = `<!doctype html>
<html lang="pt"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(subject)}</title></head>
<body style="margin:0;padding:0;background:#f3f4f6">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:24px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:12px;overflow:hidden">
<tr><td style="background:${INK};padding:18px 28px"><span style="${font}font-size:20px;font-weight:bold;letter-spacing:2px;color:#ffffff">CAMPS</span></td></tr>
<tr><td style="padding:28px">
<h1 style="${font}margin:0 0 18px;font-size:22px;line-height:1.25;color:${INK}">${escapeHtml(heading)}</h1>
${htmlParagraphs}${htmlRows}${htmlAction}${htmlFootnote}
</td></tr>
<tr><td style="padding:16px 28px;border-top:1px solid #e5e7eb"><p style="${font}margin:0;font-size:11px;color:${MUTED}">Camps · Gestão de torneios de desportos de combate. Este e-mail foi enviado automaticamente; não é preciso responder.</p></td></tr>
</table></td></tr></table>
</body></html>`;

  const text = [
    heading,
    "",
    ...paragraphs.flatMap((p) => [p, ""]),
    ...(rows.length ? [...rows.map(([label, value]) => `${label}: ${value}`), ""] : []),
    ...(action ? [`${action.label}: ${action.url}`, ""] : []),
    ...(footnote ? [footnote, ""] : []),
    "—",
    "Camps · Gestão de torneios de desportos de combate",
  ].join("\n");

  return { subject, html, text };
}
