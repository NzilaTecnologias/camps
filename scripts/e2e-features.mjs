// Funcionalidades da conta, placar por modalidade, avisos aos atletas, faturas e Plano Federação pago
// online. Precisa do servidor de desenvolvimento sem RESEND_API_KEY e com CRON_SECRET (lido do .env).
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
const mailbox = async (browser, email) => (await browser.get(`/dev/mailbox?to=${encodeURIComponent(email)}`)).html;
const linkTo = (html, path) => {
  const found = html.match(new RegExp(`href="[^"]*(${path}\\?token=[^"]+)"`))?.[1];
  return found && decode(found);
};
const day = (offset) => new Date(Date.now() + offset * 86_400_000).toISOString().slice(0, 10);
const CRON = process.env.CRON_SECRET;
/** Corre a tarefa de fundo já (avisos e fila de e-mails), à espera do bloqueio se outra volta estiver a correr. */
async function runJobs() {
  for (let i = 0; i < 40; i++) {
    const res = await fetch(`${BASE}/api/cron/jobs`, { headers: { authorization: `Bearer ${CRON}` } });
    const report = await res.json().catch(() => ({}));
    if (report.ran) return report;
    await new Promise((resolve) => setTimeout(resolve, 1500));
  }
  throw new Error("a tarefa de fundo não correu");
}

// ---------------------------------------------------------------- A minha conta
const eva = new Browser();
const evaEmail = `eva${stamp}@teste.local`;
await eva.signup("/signup", { name: "Eva Teste", email: evaEmail, password: "senha-da-eva-1" });
let r = await eva.get("/account");
check("A minha conta abre com o e-mail confirmado", strip(r.html).includes(evaEmail) && /confirmado/.test(strip(r.html)), strip(r.html).slice(0, 300));
r = await eva.get("/events");
check("menu da conta tem 'A minha conta'", r.html.includes('href="/account"'));

r = await eva.submit("/account", 'name="name"', { name: "Eva Nova" });
check("mudar o nome", r.status === 303 && r.location?.includes("ok=name"));
r = await eva.get("/account");
check("nome novo aparece", r.html.includes('value="Eva Nova"'));

const evaPhone = new Browser();
await evaPhone.submit("/login", "password", { email: evaEmail, password: "senha-da-eva-1" });
r = await eva.submit("/account", 'name="current"', { current: "errada-123", password: "nova-senha-eva", confirmation: "nova-senha-eva" });
check("mudar palavra-passe com a atual errada é recusado", r.html.includes("atual não está certa"));
r = await eva.submit("/account", 'name="current"', { current: "senha-da-eva-1", password: "nova-senha-eva", confirmation: "outra-coisa-1" });
check("palavras-passe novas diferentes são recusadas", r.html.includes("não são iguais"));
r = await eva.submit("/account", 'name="current"', { current: "senha-da-eva-1", password: "nova-senha-eva", confirmation: "nova-senha-eva" });
check("mudar palavra-passe", r.status === 303 && r.location?.includes("ok=password"), `${r.status} ${r.location}`);
r = await eva.get("/account");
check("esta sessão continua aberta", r.status === 200 && strip(r.html).includes("A minha conta"));
r = await evaPhone.get("/events");
check("a sessão do outro aparelho terminou", strip(r.html).includes("Iniciar sessão"));

const newEmail = `eva.nova${stamp}@teste.local`;
r = await eva.submit("/account", 'name="email"', { email: newEmail, password: "errada-123" });
check("mudar e-mail exige a palavra-passe certa", r.html.includes("atual não está certa"));
r = await eva.submit("/account", 'name="email"', { email: newEmail, password: "nova-senha-eva" });
check("pedido de mudança de e-mail", r.status === 303 && r.location?.includes("ok=email"));
r = await eva.get("/account");
check("e-mail novo fica à espera de confirmação", strip(r.html).includes(`À espera de confirmação: ${newEmail}`));
check("e-mail antigo recebe o aviso", (await mailbox(eva, evaEmail)).includes("Pedido para mudar o e-mail"));
const changeLink = linkTo(await mailbox(eva, newEmail), "/confirm-email-change");
check("e-mail novo recebe o link", Boolean(changeLink));
r = await new Browser().submit(changeLink, "token");
check("confirmar o novo e-mail", r.status === 303 && r.location?.includes("done=1"), `${r.status} ${r.location}`);
r = await new Browser().submit("/login", "password", { email: evaEmail, password: "nova-senha-eva" });
check("o e-mail antigo deixa de entrar", strip(r.html).includes("incorretos"));
r = await new Browser().submit("/login", "password", { email: newEmail, password: "nova-senha-eva" });
check("o e-mail novo entra", r.status === 303);

r = await eva.get("/account/export");
const exported = JSON.parse(r.html);
check("descarregar os dados traz a conta em JSON", exported.conta?.email === newEmail && exported.conta?.nome === "Eva Nova", r.html.slice(0, 200));
r = await new Browser().get("/account/export");
check("sem sessão não se descarregam dados", r.status === 401);

// A mudança de palavra-passe também tem um campo "confirmation": o formulário certo é o de eliminar.
r = await eva.submit("/account", "Eliminar definitivamente", { password: "nova-senha-eva", confirmation: "apagar" });
check("eliminar exige escrever ELIMINAR", r.html.includes("Escreva ELIMINAR"));
r = await eva.submit("/account", "Eliminar definitivamente", { password: "nova-senha-eva", confirmation: "ELIMINAR" });
check("eliminar a conta", r.status === 303 && r.location?.endsWith("/account/deleted"), `${r.status} ${r.location}`);
check("a sessão termina ao eliminar", !eva.cookies.has("camps_session"));
r = await new Browser().submit("/login", "password", { email: newEmail, password: "nova-senha-eva" });
check("conta eliminada não entra mais", strip(r.html).includes("incorretos"));

// ---------------------------------------------------------------- Organização, eventos e placar por modalidade
const org = new Browser();
const orgEmail = `org${stamp}@teste.local`;
await org.signup("/signup", { name: "Organizadora Teste", email: orgEmail, password: "senha-da-org-1" });
await org.submit("/manage", 'name="name"', { name: `Clube Feat ${stamp}` });
r = await org.get("/manage/events/new");
const organizerId = r.html.match(/<option value="([^"]+)"/)?.[1];

async function eventWithMatch(sport, names) {
  r = await org.submit("/manage/events/new", 'name="date"', {
    organizerId, name: `${sport} Feat ${stamp}`, sport, date: day(1), registrationClosesOn: day(0), venue: "Pavilhão", city: "Luanda", description: "",
  });
  const eventPath = new URL(r.location, BASE).pathname;
  await org.submit(`${eventPath}/divisions`, 'name="belt"', { gender: "MALE", ageGroup: "Adulto", belt: "Preta", weightClass: "Leve", maxWeightKg: "73", price: "0" });
  r = await org.get(`${eventPath}/divisions`);
  const divisionPath = r.html.match(new RegExp(`${eventPath}/divisions/\\w+`))?.[0];
  for (const [firstName, lastName] of names) {
    await org.submit(divisionPath, 'name="firstName"', { firstName, lastName, birthDate: "1996-02-02", academyName: "" });
  }
  return { eventPath, divisionPath };
}

const judo = await eventWithMatch("Judo", [["Kenji", "Tavares"], ["Hugo", "Neto"]]);
// Antes da chave: a organização publica o evento, para os avisos às famílias.
await org.submit(judo.eventPath, "Publicar evento");
await org.submit(judo.divisionPath, 'name="type"', { type: "SINGLE_ELIMINATION" });
r = await org.get(judo.divisionPath);
const judoControl = r.html.match(/\/manage\/matches\/\w+\/scoreboard/)?.[0];
r = await org.get(judoControl);
let page = strip(r.html);
check("placar de judo indica as regras IJF", /Judo · regras IJF/.test(page), page.slice(0, 400));
check("judo propõe 4 min por omissão", /value="240" selected/.test(r.html));
await org.submit(`${judo.eventPath}/scoreboard`, 'placeholder="Área 1"', { name: "Tatami 1" });
r = await org.get(`${judo.eventPath}/scoreboard`);
const judoMat = r.html.match(/href="\/scoreboard\/(\w+)"/)?.[1];
r = await org.submit(judoControl, 'name="matId"', { matId: judoMat, durationSeconds: "300" });
check("duração fora das regras do judo é recusada", r.html.includes("Duração inválida para esta modalidade"));
await org.submit(judoControl, 'name="matId"', { matId: judoMat, durationSeconds: "240" });
// Os botões dos marcadores só aparecem depois de abrir o placar.
r = await org.get(judoControl);
page = strip(r.html);
check("botões do judo: waza-ari e shido, sem vantagens", /\+ Waza-ari/.test(page) && /\+ Shido/.test(page) && !/Vantagens/.test(page), page.slice(0, 400));
const JUDO_FORM = 'value="points:1"';
r = await org.submit(judoControl, JUDO_FORM, { change: "points:2" });
check("botão que o judo não tem é recusado", r.html.includes("Valor inválido nesta modalidade"));
await org.submit(judoControl, JUDO_FORM, { change: "points:1" });
for (let i = 0; i < 3; i++) await org.submit(judoControl, JUDO_FORM, { change: "penalties:1" }, 1);
let board = (await (await fetch(`${BASE}/api/mats/${judoMat}/scoreboard`)).json()).scoreboard;
check(
  "placar de judo: waza-ari e shidos com os nomes certos",
  board.red.points === 1 && board.blue.penalties === 3 && board.labels.points === "Waza-ari" && board.labels.penalties === "Shido" && board.labels.advantages === null,
  JSON.stringify([board.red, board.blue, board.labels]),
);
r = await org.get(judoControl);
check("terceiro shido avisa hansoku-make", /3 shido: pelas regras IJF, perde a luta/.test(strip(r.html)));
r = await org.get(`/scoreboard/${judoMat}`);
r = await org.submit(judoControl, 'name="winner"', { winner: "red", method: "Pontos" });
check("forma de vitória de outra modalidade é recusada", r.html.includes("Escolha como a luta terminou"));
r = await org.submit(judoControl, 'name="winner"', { winner: "red", method: "Hansoku-make" });
check("terminar com hansoku-make", r.status === 303);

const tkd = await eventWithMatch("Taekwondo", [["Lee", "Sousa"], ["Rui", "Kapalo"]]);
await org.submit(tkd.divisionPath, 'name="type"', { type: "SINGLE_ELIMINATION" });
r = await org.get(tkd.divisionPath);
const tkdControl = r.html.match(/\/manage\/matches\/\w+\/scoreboard/)?.[0];
r = await org.get(tkdControl);
check("taekwondo pede a duração de cada round", /Duração de cada round \(3 rounds\)/.test(strip(r.html)));
await org.submit(tkdControl, 'name="matId"', { matId: "", durationSeconds: "120" });
r = await org.get(tkdControl);
page = strip(r.html);
check("placar de taekwondo com botões +1 a +5 e gam-jeom", /\+1 Soco/.test(page) && /\+5 Cabeça com rotação/.test(page) && /Gam-jeom/.test(page), page.slice(0, 300));
const TKD_FORM = 'value="points:5"';
await org.submit(tkdControl, TKD_FORM, { change: "points:5" });
await org.submit(tkdControl, TKD_FORM, { change: "penalties:1" });
r = await org.get(tkdControl);
page = strip(r.html);
const tkdScores = [...r.html.matchAll(/font-display text-7xl font-bold leading-none tabular-nums">(\d+)</g)].map((m) => Number(m[1]));
check("gam-jeom do vermelho dá um ponto ao azul", tkdScores[0] === 5 && tkdScores[1] === 1, JSON.stringify(tkdScores));
await org.submit(tkdControl, TKD_FORM, { change: "penalties:-1" });
r = await org.get(tkdControl);
const tkdAfter = [...r.html.matchAll(/font-display text-7xl font-bold leading-none tabular-nums">(\d+)</g)].map((m) => Number(m[1]));
check("tirar o gam-jeom tira o ponto ao azul", tkdAfter[0] === 5 && tkdAfter[1] === 0, JSON.stringify(tkdAfter));

// ---------------------------------------------------------------- Avisos aos atletas (lembrete, chave, resultado)
await runJobs();
let box = await mailbox(org, orgEmail);
check("lembrete do evento de amanhã chega a quem inscreveu", box.includes(`Lembrete: Judo Feat ${stamp}`) && box.includes("Kenji Tavares"), strip(box).slice(0, 300));
check("aviso de chave publicada", box.includes(`Chave publicada: Adulto Masculino Preta Leve — Judo Feat ${stamp}`));
// O vencedor depende do sorteio da chave: um fica com o ouro e o outro com a prata.
const medals = ["Kenji Tavares", "Hugo Neto"].map((name) => box.match(new RegExp(`Resultado: ${name} — (\\d)\\.º lugar`))?.[1]).sort();
check("resultado de cada atleta (ouro e prata)", medals.join(",") === "1,2", JSON.stringify(medals));
check("evento por publicar não tem avisos", !box.includes(`Lembrete: Taekwondo Feat ${stamp}`));
// Só o texto visível: em desenvolvimento, os dados do React repetem cada e-mail no HTML.
const countOf = (html, text) => strip(html).split(text).length - 1;
const before = countOf(box, `Lembrete: Judo Feat ${stamp}`);
await runJobs();
box = await mailbox(org, orgEmail);
check("avisos não se repetem na volta seguinte", countOf(box, `Lembrete: Judo Feat ${stamp}`) === before && countOf(box, "Resultado: Kenji Tavares —") === 1);

// ---------------------------------------------------------------- Faturas da taxa
const admin = new Browser();
await admin.submit("/admin/login", "password", { email: "admin@camps.local", password: "camps-admin" });
const billingPath = `${judo.eventPath}/billing`;
r = await org.submit(billingPath, 'name="billingNif"', { billingName: "Clube Feat Lda", billingNif: "123", billingAddress: "Rua 1, Luanda" });
check("NIF inválido é recusado", r.html.includes("NIF inválido"));
await org.submit(billingPath, 'name="billingNif"', { billingName: "Clube Feat Lda", billingNif: "5417 000 111", billingAddress: "Rua 1, Talatona, Luanda" });
r = await org.get(billingPath);
check("dados de faturação ficam guardados", r.html.includes('value="5417000111"'));
// Botão "Faturar a taxa agora" da linha deste evento: o formulário leva o id do evento num campo escondido.
const judoEventId = judo.eventPath.split("/").pop();
const feeForm = (raw) =>
  (raw.replace(/<script[\s\S]*?<\/script>/g, "").match(/<form[\s\S]*?<\/form>/g) ?? [])
    .filter((form) => form.includes("Faturar a taxa agora"))
    .findIndex((form) => form.includes(judoEventId));
r = await admin.get("/admin/payouts");
await admin.submit("/admin/payouts", "Faturar a taxa agora", {}, feeForm(r.html));
r = await org.get(billingPath);
const invoicePath = r.html.match(/href="(\/invoices\/\w+)"/)?.[1];
check("fatura da taxa aparece ao organizador", Boolean(invoicePath) && /FR CAMPS\d{4}\/\d+/.test(strip(r.html)), strip(r.html).slice(0, 200));
r = await org.get(invoicePath);
page = strip(r.html);
check(
  "fatura com cliente, NIF, 2 atletas × 500 Kz e IVA incluído",
  /Clube Feat Lda/.test(page) && /NIF 5417000111/.test(page) && /1\s000,00\sKz/.test(page) && /IVA \(\s?14 %\)/.test(page) && /Documento interno/.test(page),
  page.slice(0, 600),
);
r = await new Browser().get(invoicePath);
check("fatura não abre sem sessão", !strip(r.html).includes("Clube Feat Lda"));
const stranger = new Browser();
await stranger.signup("/signup", { name: "Estranho", email: `estranho${stamp}@teste.local`, password: "senha-estranha-1" });
r = await stranger.get(invoicePath);
check("fatura não abre para quem não é da organização", !strip(r.html).includes("Clube Feat Lda"));
// A equipa vê as faturas na administração; a página do site é só do cliente.
r = await admin.get(`/admin${invoicePath}`);
check("administrador abre a fatura na administração", strip(r.html).includes("Clube Feat Lda"));
r = await admin.get(invoicePath);
check("a sessão de administração não abre a página do cliente", !strip(r.html).includes("Clube Feat Lda"));
r = await admin.get("/admin/payouts");
r = await admin.submit("/admin/payouts", "Faturar a taxa agora", {}, feeForm(r.html));
check("sem atletas novos não sai outra fatura", r.html.includes("Não há atletas confirmados por faturar"));
await runJobs();
check("fatura chega por e-mail ao dono", (await mailbox(org, orgEmail)).includes("Fatura FR CAMPS"));

// ---------------------------------------------------------------- Plano Federação pago online
r = await org.submit("/manage", "Criar federação", { name: `Fed Feat ${stamp}`, sport: "Judo" });
const F = new URL(r.location, BASE).pathname;
r = await org.get(`${F}/billing`);
check("página Plano e faturas mostra os dois planos", /Sem plano ativo/.test(strip(r.html)) && /Básico/.test(strip(r.html)) && /Premium/.test(strip(r.html)));
await org.submit(`${F}/billing`, 'name="billingNif"', { billingName: "Federação Feat", billingNif: "5000111222", billingAddress: "Av. 4 de Fevereiro, Luanda" });
await org.submit(`${F}/billing`, 'name="plan"', { plan: "BASIC", provider: "SIMULATOR", mobile: "" });
r = await org.get(`${F}/billing`);
check("pagamento do plano fica à espera", /Simulador de pagamentos/.test(strip(r.html)));
await org.submit(`${F}/billing`, "Simular aprovado");
r = await org.get(`${F}/billing`);
page = strip(r.html);
check("plano pago fica ativo por 12 meses", /Básico até/.test(page) && /Pago/.test(page), page.slice(0, 400));
check("fatura do plano aparece", /FR CAMPS\d{4}\/\d+/.test(page));
const planInvoice = r.html.match(/href="(\/invoices\/\w+)"/)?.[1];
r = await org.get(planInvoice);
check("fatura do plano com o valor do Básico", /Plano Federação Básico — 12 meses/.test(strip(r.html)) && /150\s000,00\sKz/.test(strip(r.html)), strip(r.html).slice(0, 400));
r = await new Browser().get(`/f/fed-feat-${stamp}`);
check("federação paga já aparece ao público", r.status === 200 && strip(r.html).includes(`Fed Feat ${stamp}`));
await org.submit(`${F}/billing`, 'name="plan"', { plan: "PREMIUM", provider: "SIMULATOR", mobile: "" });
await org.submit(`${F}/billing`, "Simular aprovado");
r = await org.get(`${F}/billing`);
const nextYear = new Date().getUTCFullYear() + 2;
check("renovar antes do fim soma 12 meses e muda para Premium", new RegExp(`Premium até .*${nextYear}`).test(strip(r.html)), strip(r.html).slice(0, 300));

console.log(failures ? `\n${failures} falha(s)` : "\ntudo ok");
process.exit(failures ? 1 : 0);
