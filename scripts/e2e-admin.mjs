// Área de administração: separada do site, entrada e sessão próprias, papéis da equipa e registo de
// atividade. Precisa do servidor de desenvolvimento com os dados do seed (npm run db:seed).
import "dotenv/config";
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
    // Sem os scripts: os dados do React podem repetir pedaços da página e baralhar a contagem.
    const html = (await this.get(path)).html.replace(/<script[\s\S]*?<\/script>/g, "");
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

// ---------------------------------------------------------------- Separação do site
const anon = new Browser();
let r = await anon.get("/admin");
check("sem sessão de administração, /admin vai para a entrada própria", r.status === 307 && r.location?.endsWith("/admin/login"), `${r.status} ${r.location}`);
r = await anon.get("/admin/users");
check("e qualquer página da administração também", r.status === 307 && r.location?.endsWith("/admin/login"));
r = await anon.get("/admin/login");
check("entrada da administração abre e não tem o menu do site", r.status === 200 && strip(r.html).includes("Entrar na administração") && !r.html.includes('href="/events"'));
check("administração não é indexada", /<meta name="robots" content="noindex, nofollow"/.test(r.html));

// Uma sessão do site, mesmo de administrador, não abre a administração.
const siteAdmin = new Browser();
await siteAdmin.submit("/login", "password", { email: "admin@camps.local", password: "camps-admin" });
check("o administrador entra no site como qualquer pessoa", siteAdmin.cookies.has("camps_session"));
r = await siteAdmin.get("/admin");
check("a sessão do site não abre a administração", r.status === 307 && r.location?.endsWith("/admin/login"));
r = await siteAdmin.get("/events");
check("o menu da conta no site não tem atalhos para a administração", !r.html.includes('href="/admin'));

// Quem não é da equipa não entra, e a mensagem não o denuncia.
const org = new Browser();
r = await org.submit("/admin/login", "password", { email: "organizador@camps.local", password: "camps-demo" });
check("conta sem papel na equipa não entra", strip(r.html).includes("sem acesso à administração") && !org.cookies.has("camps_admin"));
r = await org.submit("/admin/login", "password", { email: "admin@camps.local", password: "errada-123" });
check("palavra-passe errada dá a mesma mensagem", strip(r.html).includes("sem acesso à administração"));

// ---------------------------------------------------------------- Entrada do administrador
const admin = new Browser();
r = await admin.submit("/admin/login", "password", { email: "admin@camps.local", password: "camps-admin" });
check("administrador entra e vai para o painel", r.status === 303 && r.location?.endsWith("/admin"), `${r.status} ${r.location}`);
check("sessão de administração própria", admin.cookies.has("camps_admin") && !admin.cookies.has("camps_session"));
r = await admin.get("/admin");
check("painel abre com os números da plataforma", /Olá, Admin/.test(strip(r.html)) && /Utilizadores/.test(strip(r.html)) && /Pagamentos pendentes/.test(strip(r.html)), strip(r.html).slice(0, 300));
check("administrador vê todas as secções", ["/admin/users", "/admin/invoices", "/admin/staff", "/admin/audit", "/admin/system"].every((href) => r.html.includes(`href="${href}"`)));
r = await admin.get("/manage");
check("a sessão de administração não abre o site", r.status === 307 && r.location?.includes("/login"));

// ---------------------------------------------------------------- Utilizadores: suspender e reativar
const victimEmail = `vitima${stamp}@teste.local`;
const victim = new Browser();
await victim.signup("/signup", { name: "Vítima Teste", email: victimEmail, password: "senha-vitima-1" });
r = await admin.get(`/admin/users?q=${encodeURIComponent(victimEmail)}`);
const victimPath = r.html.match(/href="(\/admin\/users\/\w+)"/)?.[1];
check("pesquisa encontra a conta", Boolean(victimPath) && strip(r.html).includes("Vítima Teste"));
r = await admin.get(victimPath);
check("ficha da conta mostra sessões e ações", /Sessões abertas no site 1/.test(strip(r.html)) && /Suspender a conta/.test(strip(r.html)), strip(r.html).slice(0, 400));
r = await admin.submit(victimPath, 'name="reason"', { reason: "x" });
check("suspender sem motivo é recusado", r.html.includes("Indique o motivo da suspensão"));
await admin.submit(victimPath, 'name="reason"', { reason: "Pagamentos fraudulentos" });
r = await victim.get("/events");
check("suspender termina a sessão no site", strip(r.html).includes("Iniciar sessão"));
r = await new Browser().submit("/login", "password", { email: victimEmail, password: "senha-vitima-1" });
check("conta suspensa não entra no site", strip(r.html).includes("Esta conta está suspensa"));
r = await admin.get(victimPath);
check("ficha mostra a suspensão e o motivo", /Suspensa/.test(strip(r.html)) && /Pagamentos fraudulentos/.test(strip(r.html)));
await admin.submit(victimPath, "Reativar a conta");
r = await new Browser().submit("/login", "password", { email: victimEmail, password: "senha-vitima-1" });
check("conta reativada volta a entrar", r.status === 303);

// ---------------------------------------------------------------- Eventos: despublicar e voltar a publicar
r = await admin.get("/admin/events?status=PUBLISHED");
check("lista de eventos por estado", /Copa Camps de Jiu-Jitsu 2026/.test(strip(r.html)));
const copa = await anon.get("/events/copa-camps-2026");
check("a Copa está pública", copa.status === 200 && strip(copa.html).includes("Copa Camps de Jiu-Jitsu 2026"));
// Filtrada pelo nome, a lista só tem a Copa: o formulário é o primeiro.
await admin.submit(`/admin/events?q=${encodeURIComponent("Copa Camps")}`, "Despublicar", { reason: "Verificação de documentos" });
r = await anon.get("/events/copa-camps-2026");
check("evento despublicado sai do site", !strip(r.html).includes("Categorias"), `${r.status}`);
await admin.submit(`/admin/events?q=${encodeURIComponent("Copa Camps")}&status=DRAFT`, "Publicar", {});
r = await anon.get("/events/copa-camps-2026");
check("voltar a publicar devolve-o ao site", strip(r.html).includes("Copa Camps de Jiu-Jitsu 2026") && strip(r.html).includes("Categorias"));

// ---------------------------------------------------------------- Equipa e papéis
r = await admin.submit("/admin/staff", 'name="role"', { email: `naoexiste${stamp}@teste.local`, role: "SUPPORT" });
check("só se dá papel a contas que existem", r.html.includes("Não há nenhuma conta com esse e-mail"));
await admin.submit("/admin/staff", 'name="role"', { email: victimEmail, role: "SUPPORT" });
r = await admin.get("/admin/staff");
check("nova pessoa aparece na equipa como Suporte", strip(r.html).includes("Vítima Teste") && /Suporte/.test(strip(r.html)));

const support = new Browser();
r = await support.submit("/admin/login", "password", { email: victimEmail, password: "senha-vitima-1" });
check("suporte entra na administração", r.status === 303 && support.cookies.has("camps_admin"));
r = await support.get("/admin");
check("suporte só vê as secções do seu papel", r.html.includes('href="/admin/users"') && !r.html.includes('href="/admin/invoices"') && !r.html.includes('href="/admin/staff"'));
r = await support.get("/admin/invoices");
check("suporte não abre as faturas", r.status === 404 || !strip(r.html).includes("compras de créditos"), `${r.status}`);
r = await support.get("/admin/staff");
check("suporte não abre a equipa", r.status === 404 || !strip(r.html).includes("Acrescentar ou mudar papel"));
const finance = new Browser();
await finance.submit("/admin/login", "password", { email: "financeiro@camps.local", password: "camps-financeiro" });
r = await finance.get("/admin/organizers");
check("financeiro vê os saldos de créditos e pode acertá-los", strip(r.html).includes("saldo de créditos") && r.html.includes('name="delta"'));
r = await finance.get("/admin/users");
check("financeiro não abre os utilizadores", r.status === 404 || !strip(r.html).includes("Abra uma conta"));
r = await finance.get("/admin/invoices");
check("financeiro abre as faturas", strip(r.html).includes("Faturas das compras de créditos"));

const staffPage = await admin.get("/admin/staff");
const removeIndex = (staffPage.html.replace(/<script[\s\S]*?<\/script>/g, "").match(/<form[\s\S]*?<\/form>/g) ?? [])
  .filter((form) => form.includes("Tirar da equipa"))
  .findIndex((form) => form.includes(victimPath.split("/").pop()));
await admin.submit("/admin/staff", "Tirar da equipa", {}, removeIndex);
r = await support.get("/admin");
// A página vem em streaming (200) e manda para a entrada lá dentro: o menu da administração já não aparece.
check("tirar da equipa fecha logo a administração a essa pessoa", !r.html.includes('href="/admin/users"') && !strip(r.html).includes("Olá,"), `${r.status}`);

// ---------------------------------------------------------------- Outras secções e registo
for (const [path, text] of [
  ["/admin/organizers", "Liga Camps"],
  ["/admin/payments", "Pagamentos"],
  ["/admin/emails", "E-mails"],
  ["/admin/federations", "Federação Demo"],
  ["/admin/system", "Trabalho de fundo"],
]) {
  r = await admin.get(path);
  check(`${path} abre`, r.status === 200 && strip(r.html).includes(text), strip(r.html).slice(0, 200));
}
r = await admin.submit("/admin/system", "Correr agora", {});
check("correr a tarefa de fundo agora", r.status === 200 && !r.html.includes("O seu papel"));
r = await admin.get("/admin/audit");
const audit = strip(r.html);
check(
  "registo de atividade guarda entradas, falhas e ações",
  ["login.failed", "user.suspend", "user.reactivate", "event.status.draft", "event.status.published", "staff.role", "staff.remove", "system.jobs"].every((action) => audit.includes(action)),
  audit.slice(0, 600),
);
r = await admin.get(`/admin/audit?action=user.suspend`);
check("registo filtra por ação e mostra o motivo", strip(r.html).includes("Pagamentos fraudulentos") && !strip(r.html).includes("staff.role"));

await admin.submit("/admin", "Sair da administração", {});
r = await admin.get("/admin");
check("sair termina a sessão de administração", r.status === 307 && r.location?.endsWith("/admin/login"));

console.log(failures ? `\n${failures} falha(s)` : "\ntudo ok");
process.exit(failures ? 1 : 0);
