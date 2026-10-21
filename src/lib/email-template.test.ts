import { describe, expect, it } from "vitest";
import { escapeHtml, renderEmail } from "./email-template";
import { stackFrames } from "@/server/error-report";

describe("renderEmail", () => {
  const email = renderEmail({
    subject: "Inscrição confirmada",
    heading: "Olá <Ana>",
    paragraphs: ['A "Copa" & companhia'],
    rows: [["Valor", "15 000,00 Kz"]],
    action: { label: "Ver", url: "https://camps.ao/registrations/1?a=1&b=2" },
    footnote: "Ignore se não foi você.",
  });

  it("escapa o conteúdo no HTML", () => {
    expect(email.html).toContain("Olá &lt;Ana&gt;");
    expect(email.html).toContain("A &quot;Copa&quot; &amp; companhia");
    expect(email.html).toContain('href="https://camps.ao/registrations/1?a=1&amp;b=2"');
    expect(email.html).not.toContain("<Ana>");
  });

  it("tem uma versão em texto com o link e os detalhes", () => {
    expect(email.text).toContain("Olá <Ana>");
    expect(email.text).toContain("Valor: 15 000,00 Kz");
    expect(email.text).toContain("Ver: https://camps.ao/registrations/1?a=1&b=2");
    expect(email.text).toContain("Ignore se não foi você.");
  });

  it("escapeHtml trata aspas simples", () => {
    expect(escapeHtml("it's")).toBe("it&#39;s");
  });
});

describe("stackFrames", () => {
  it("converte o stack do V8 em frames do Sentry, o mais recente no fim", () => {
    const frames = stackFrames(
      [
        "Error: falhou",
        "    at settle (C:\\app\\src\\server\\registrations.ts:10:5)",
        "    at async Promise.all (index 0)",
        "    at run (/app/node_modules/next/dist/server.js:3:1)",
      ].join("\n"),
    );
    expect(frames).toEqual([
      { function: "run", filename: "/app/node_modules/next/dist/server.js", lineno: 3, colno: 1, in_app: false },
      { function: "settle", filename: "C:\\app\\src\\server\\registrations.ts", lineno: 10, colno: 5, in_app: true },
    ]);
  });
});
