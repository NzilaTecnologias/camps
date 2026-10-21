// Contas e e-mails: termos no registo, confirmação do e-mail, nova palavra-passe, limites e
// páginas legais. Precisa do servidor sem RESEND_API_KEY: os e-mails ficam em /dev/mailbox.
const BASE = process.argv[2] ?? "http://localhost:3000";

const decode = (s) =>
  s.replace(/&quot;/g, '"').replace(/&#x27;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
const strip = (html) => decode(html.replace(/<script[\s\S]*?<\/script>/g, " ").replace(/<[^>]*>/g, " ")).replace(/\s+/g, " ");

let failures = 0;
function check(label, ok, detail = "") {
  if (!ok) failures++;
  console.log(`${ok ? "ok  " : "FAIL"} ${label}${ok || !detail ? "" : ` — ${detail}`}`);
}

class Browser {
  cookies = new Map();
  async request(path, init = {}) {
    const headers = { ...(init.headers ?? {}) };
    if (this.cookies.size) headers.cookie = [...this.cookies].map(([k, v]) => `${k}=${v}`).join("; ");
    const res = await fetch(BASE + path, { ...init, headers, redirect: "manual" });
    for (const line of res.headers.getSetCookie()) {
      const [pair] = line.split(";");
      const [name, ...value] = pair.split("=");
      if (/max-age=0|expires=thu, 01 jan 1970/i.test(line) || value.join("=") === "") this.cookies.delete(name);
      else this.cookies.set(name, value.join("="));
    }
    return res;
  }
  async get(path) {
    const res = await this.request(path);
    return { status: res.status, location: res.headers.get("location"), html: await res.text() };
  }
  /** Cria conta (aceitando os termos) e confirma o e-mail pela caixa de correio de desenvolvimento. */
  async signup(path, fields) {
    const res = await this.submit(path, "password", { terms: "on", ...fields });
    if (res.status === 303) await this.confirmEmail(fields.email);
    return res;
  }
  /** Abre o link de confirmação mais recente enviado para `email` (precisa do servidor sem RESEND_API_KEY). */
  async confirmEmail(email) {
    const { html } = await this.get(`/dev/mailbox?to=${encodeURIComponent(email)}`);
    const link = html.match(/href="[^"]*(\/verify-email\?token=[^"]+)"/)?.[1];
    if (!link) throw new Error(`não chegou o e-mail de confirmação para ${email}`);
    await this.submit(decode(link), "token");
  }
  /** Envia o formulário da página `path` que contém `marker`, com os campos dados. */
  async submit(path, marker, fields = {}, nth = 0) {
    const { html } = await this.get(path);
    const form = (html.match(/<form[\s\S]*?<\/form>/g) ?? []).filter((f) => f.includes(marker))[nth];
    if (!form) throw new Error(`formulário com "${marker}" não encontrado em ${path}`);
    const body = new FormData();
    for (const input of form.match(/<input[^>]*type="hidden"[^>]*>/g) ?? []) {
      const name = input.match(/name="([^"]*)"/)?.[1];
      // Um campo escondido que o teste também preenche fica com o valor do teste.
      if (name && !(decode(name) in fields)) body.append(decode(name), decode(input.match(/value="([^"]*)"/)?.[1] ?? ""));
    }
    for (const [name, value] of Object.entries(fields)) body.append(name, value);
    const res = await this.request(path, { method: "POST", body });
    return { status: res.status, location: res.headers.get("location"), html: await res.text() };
  }
}

const stamp = Date.now();
const mailbox = async (browser, email) => (await browser.get(`/dev/mailbox?to=${encodeURIComponent(email)}`)).html;
const linkTo = (html, path) => {
  const found = html.match(new RegExp(`href="[^"]*(${path}\\?token=[^"]+)"`))?.[1];
  return found && decode(found);
};

// Páginas legais
for (const path of ["/terms", "/privacy"]) {
  const page = await new Browser().get(path);
  check(`${path} abre`, page.status === 200, String(page.status));
}
let r = await new Browser().get("/signup");
check("registo tem a caixa dos termos com links", r.html.includes('name="terms"') && r.html.includes('href="/terms"') && r.html.includes('href="/privacy"'));

// Registo sem aceitar os termos
const ana = new Browser();
const anaEmail = `ana${stamp}@teste.local`;
r = await ana.submit("/signup", "password", { name: "Ana Teste", email: anaEmail, password: "senha-da-ana-1" });
check("registo sem aceitar os termos é recusado", strip(r.html).includes("aceite os Termos"), strip(r.html).slice(0, 200));

// Registo; o e-mail ainda não está confirmado
r = await ana.submit("/signup", "password", { name: "Ana Teste", email: anaEmail, password: "senha-da-ana-1", terms: "on" });
check("registo com os termos entra", r.status === 303 && ana.cookies.has("camps_session"), `${r.status}`);
r = await ana.get("/events");
check("aviso de e-mail por confirmar aparece", strip(r.html).includes("Confirme o seu e-mail"));
r = await ana.submit("/manage", 'name="name"', { name: `Clube da Ana ${stamp}` });
// O formulário está dentro de um Suspense: o erro vem nos dados do React, não no HTML inicial.
check("sem e-mail confirmado não pode criar organização", r.html.includes("Confirme primeiro o seu e-mail"));

let box = await mailbox(ana, anaEmail);
const verifyLink = linkTo(box, "/verify-email");
check("e-mail de confirmação chegou", Boolean(verifyLink) && box.includes("Confirme o seu e-mail na Camps"));
r = await new Browser().get(verifyLink);
check("abrir o link não confirma sozinho (mostra o botão)", strip(r.html).includes("Confirmar e-mail") && r.html.includes('name="token"'));
r = await ana.get("/events");
check("…e o aviso continua", strip(r.html).includes("Confirme o seu e-mail"));
r = await new Browser().submit(verifyLink, "token");
check("o botão confirma", r.status === 303 && r.location?.includes("/verify-email?done=1"), `${r.status} ${r.location}`);
r = await ana.get("/events");
check("aviso desaparece depois de confirmar", !strip(r.html).includes("Confirme o seu e-mail"));
r = await new Browser().get(verifyLink);
check("link de confirmação só serve uma vez", strip(r.html).includes("já foi usado ou expirou"));
r = await ana.submit("/manage", 'name="name"', { name: `Clube da Ana ${stamp}` });
r = await ana.get("/manage");
check("com o e-mail confirmado já cria organização", strip(r.html).includes(`Clube da Ana ${stamp}`));

// Reenviar a confirmação
const rui = new Browser();
const ruiEmail = `rui${stamp}@teste.local`;
await rui.submit("/signup", "password", { name: "Rui Teste", email: ruiEmail, password: "senha-do-rui-1", terms: "on" });
const firstLink = linkTo(await mailbox(rui, ruiEmail), "/verify-email");
r = await rui.submit("/events", "Reenviar");
check("reenviar responde", r.status === 200, String(r.status));
const secondLink = linkTo(await mailbox(rui, ruiEmail), "/verify-email");
check("reenviar manda um link novo", Boolean(secondLink) && secondLink !== firstLink);
r = await new Browser().get(firstLink);
check("o link antigo deixa de valer", strip(r.html).includes("já foi usado ou expirou"));

// Nova palavra-passe
r = await new Browser().get("/login");
check("login tem o link 'Esqueceu-se da palavra-passe?'", r.html.includes('href="/forgot-password"'));
const otherDevice = new Browser();
await otherDevice.submit("/login", "password", { email: anaEmail, password: "senha-da-ana-1" });
check("ana tem sessão noutro aparelho", otherDevice.cookies.has("camps_session"));

const stranger = new Browser();
const nobody = `ninguem${stamp}@teste.local`;
r = await stranger.submit("/forgot-password", "email", { email: nobody });
check("pedido para e-mail inexistente dá a mesma resposta", r.status === 303 && r.location?.includes("sent=1"), `${r.status} ${r.location}`);
check("…e não envia nada", !(await mailbox(stranger, nobody)).includes("/reset-password"));
r = await stranger.submit("/forgot-password", "email", { email: anaEmail });
check("pedido para e-mail existente", r.status === 303 && r.location?.includes("sent=1"));
r = await stranger.get("/forgot-password?sent=1");
check("mensagem neutra depois do pedido", strip(r.html).includes("Se existir uma conta"));
const resetLink = linkTo(await mailbox(stranger, anaEmail), "/reset-password");
check("e-mail com link de nova palavra-passe chegou", Boolean(resetLink));
r = await stranger.submit(resetLink, "confirmation", { password: "nova-senha-123", confirmation: "outra-coisa-1" });
check("palavras-passe diferentes são recusadas", strip(r.html).includes("não são iguais"));
r = await stranger.submit(resetLink, "confirmation", { password: "curta", confirmation: "curta" });
check("palavra-passe curta é recusada", strip(r.html).includes("pelo menos 8"));
r = await stranger.submit(resetLink, "confirmation", { password: "nova-senha-123", confirmation: "nova-senha-123" });
check(
  "nova palavra-passe guarda e entra",
  r.status === 303 && r.location?.endsWith("/registrations") && stranger.cookies.has("camps_session"),
  `${r.status} ${r.location}`,
);
r = await otherDevice.get("/events");
check("sessões antigas são terminadas", strip(r.html).includes("Iniciar sessão"));
r = await ana.get("/events");
check("…incluindo a do aparelho principal", strip(r.html).includes("Iniciar sessão"));
r = await new Browser().get(resetLink);
check("link de nova palavra-passe só serve uma vez", strip(r.html).includes("já foi usado ou expirou"));
const again = new Browser();
r = await again.submit("/login", "password", { email: anaEmail, password: "senha-da-ana-1" });
check("palavra-passe antiga deixa de funcionar", strip(r.html).includes("incorretos"));
r = await again.submit("/login", "password", { email: anaEmail, password: "nova-senha-123" });
check("palavra-passe nova funciona", r.status === 303);
r = await new Browser().get("/reset-password?token=inventado");
check("link inventado mostra 'expirou'", strip(r.html).includes("já foi usado ou expirou"));

// Limite de pedidos de links para o mesmo e-mail
const spammer = new Browser();
const victim = `vitima${stamp}@teste.local`;
let limited = false;
for (let i = 0; i < 7 && !limited; i++) {
  r = await spammer.submit("/forgot-password", "email", { email: victim });
  limited = strip(r.html).includes("Demasiados pedidos");
}
check("pedidos de link para o mesmo e-mail têm limite", limited);

console.log(failures ? `\n${failures} falha(s)` : "\ntudo ok");
process.exit(failures ? 1 : 0);
