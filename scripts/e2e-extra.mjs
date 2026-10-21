// Complemento de e2e.mjs: ações menos usadas do painel do organizador, rotas de pagamento,
// filtros públicos e tentativas de outro utilizador reenviar formulários do organizador.
// Escreve dados de teste; depois correr `npm run db:seed` (ou o seed) para repor a demonstração.
const BASE = process.argv[2] ?? "http://localhost:3000";
const decode = (s) =>
  s.replace(/&quot;/g, '"').replace(/&#x27;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
const strip = (html) => decode(html.replace(/<script[\s\S]*?<\/script>/g, " ").replace(/<[^>]*>/g, " ")).replace(/\s+/g, " ");
let failures = 0;
const check = (label, ok, detail = "") => {
  if (!ok) failures++;
  console.log(`${ok ? "ok  " : "FAIL"} ${label}${ok || !detail ? "" : ` — ${detail}`}`);
};

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
  formData(html, marker, fields, nth = 0) {
    const form = (html.match(/<form[\s\S]*?<\/form>/g) ?? []).filter((f) => f.includes(marker))[nth];
    if (!form) throw new Error(`formulário com "${marker}" não encontrado`);
    const body = new FormData();
    for (const input of form.match(/<input[^>]*type="hidden"[^>]*>/g) ?? []) {
      const name = input.match(/name="([^"]*)"/)?.[1];
      if (name && !(decode(name) in fields)) body.append(decode(name), decode(input.match(/value="([^"]*)"/)?.[1] ?? ""));
    }
    for (const [name, value] of Object.entries(fields)) body.append(name, value);
    return body;
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
  async submit(path, marker, fields = {}, nth = 0) {
    const { html } = await this.get(path);
    const res = await this.request(path, { method: "POST", body: this.formData(html, marker, fields, nth) });
    return { status: res.status, location: res.headers.get("location"), html: await res.text() };
  }
  /** Reenvia um formulário que só o `owner` vê, mas com a sessão deste navegador. */
  async replay(owner, path, marker, fields = {}, nth = 0) {
    const { html } = await owner.get(path);
    const res = await this.request(path, { method: "POST", body: this.formData(html, marker, fields, nth) });
    return { status: res.status, html: await res.text() };
  }
}

const stamp = Date.now();
const alice = new Browser(), bob = new Browser(), carol = new Browser(), anon = new Browser();
await alice.signup("/signup", { name: "Alice X", email: `ax${stamp}@t.local`, password: "senha-da-alice" });
await bob.signup("/signup", { name: "Bob X", email: `bx${stamp}@t.local`, password: "senha-do-bob-1" });
await carol.signup("/signup", { name: "Carol X", email: `cx${stamp}@t.local`, password: "senha-da-carol" });
await alice.submit("/manage", 'name="name"', { name: `Liga X ${stamp}` });
const organizerId = (await alice.get("/manage/events/new")).html.match(/<option value="([^"]+)"/)?.[1];
let r = await alice.submit("/manage/events/new", 'name="date"', {
  organizerId, name: `Torneio X ${stamp}`, sport: "Judo", date: "2027-05-20", registrationClosesOn: "2027-05-10", venue: "Pavilhão", city: "Benguela", description: "",
});
const E = new URL(r.location, BASE).pathname;
const slug = `torneio-x-${stamp}`;
await alice.submit(`${E}/divisions`, 'name="belt"', { gender: "MALE", ageGroup: "Adulto", belt: "Azul", weightClass: "Leve", maxWeightKg: "76", price: "1000" });
const divId = (await alice.get(`${E}/divisions`)).html.match(new RegExp(`${E}/divisions/(\\w+)`))?.[1];
await alice.submit(E, "Publicar evento");

// Publicar e despublicar
r = await anon.get(`/events/${slug}`);
check("evento publicado abre ao público", r.status === 200 && strip(r.html).includes(`Torneio X ${stamp}`));
await alice.submit(E, "Despublicar");
r = await anon.get(`/events/${slug}`);
check("evento despublicado deixa de abrir ao público", !strip(r.html).includes("Azul Leve"), strip(r.html).slice(0, 200));
r = await anon.get(`/events?q=${encodeURIComponent(`Torneio X ${stamp}`)}`);
check("evento despublicado sai da lista", !strip(r.html).includes(`Torneio X ${stamp}`));
await alice.submit(E, "Publicar evento");

// Cupões: desativar, ativar, apagar
const D = `${E}/discounts`;
await alice.submit(D, 'name="code"', { code: "TESTE50", kind: "percent", value: "50", maxUses: "", expiresOn: "" });
await alice.submit(D, 'name="code"', { code: "APAGAR", kind: "amount", value: "100", maxUses: "", expiresOn: "" });
r = await alice.submit(D, 'name="code"', { code: "teste50", kind: "percent", value: "10", maxUses: "", expiresOn: "" });
check("cupão com código repetido é recusado", r.html.includes("Já existe o cupão TESTE50"));
r = await alice.submit(D, 'name="code"', { code: "MAIS100", kind: "percent", value: "150", maxUses: "", expiresOn: "" });
check("percentagem acima de 100 é recusada", r.html.includes("de 1 a 100"));
await alice.submit(D, "Desativar", {}, 1);
r = await alice.get(D);
check("cupão desativado aparece como desativado", /Desativado/.test(strip(r.html)), strip(r.html).slice(0, 300));
const reg = `/events/${slug}/divisions/${divId}/register`;
const athlete = { athleteId: "", firstName: "Zé", lastName: "Teste", birthDate: "1998-01-01", academyName: "", mobile: "", provider: "SIMULATOR" };
r = await carol.submit(reg, 'name="athleteId"', { ...athlete, couponCode: "TESTE50" });
const desativado = r.html.includes("não existe ou já não está ativo");
r = await carol.submit(reg, 'name="athleteId"', { ...athlete, couponCode: "APAGAR" });
check("cupão desativado é recusado na inscrição (um dos dois)", desativado || r.html.includes("não existe ou já não está ativo"));
r = await alice.get(D);
await alice.submit(D, "Ativar");
r = await alice.get(D);
check("cupão reativado volta a ficar ativo", !/Desativado/.test(strip(r.html)));
await alice.submit(D, "Apagar", {}, 0);
r = await alice.get(D);
const remaining = ["TESTE50", "APAGAR"].filter((c) => strip(r.html).includes(c));
check("cupão sem usos é apagado", remaining.length === 1, remaining.join(","));

// Desconto antecipado: ligar e desligar
await alice.submit(D, 'name="percent"', { percent: "15", endsOn: "2027-05-01" });
r = await alice.get(D);
check("desconto antecipado ligado", /15% até/.test(strip(r.html)));
await alice.submit(D, 'name="percent"', { percent: "0", endsOn: "" });
r = await alice.get(D);
check("desconto antecipado desligado com 0", /Desligado/.test(strip(r.html)));

// Inscrição paga e reembolso manual
r = await carol.submit(reg, 'name="athleteId"', athlete);
const regPath = new URL(r.location, BASE).pathname;
await carol.submit(regPath, "Simular aprovado");
r = await carol.get(regPath);
check("inscrição paga de 1000 Kz", /1\s000,00\sKz pagos/.test(strip(r.html)), strip(r.html).slice(0, 300));

// Faturação: taxa por atleta, conta para repasses e transferência registada pelo administrador
const B = `${E}/billing`;
r = await alice.get(B);
check("extrato: 1 atleta, taxa de 500 Kz e saldo de 500 Kz", /Atletas confirmados 1\b/.test(strip(r.html)) && /Saldo a transferir 500,00\sKz/.test(strip(r.html)), strip(r.html).slice(0, 600));
r = await alice.submit(B, 'name="iban"', { holder: "Liga X Lda", iban: "AO16004000001234567810174" });
check("IBAN com dígitos de controlo errados é recusado", r.html.includes("IBAN inválido"));
await alice.submit(B, 'name="iban"', { holder: "Liga X Lda", iban: "ao15 0040 0000 1234 5678 1017 4" });
r = await alice.get(B);
check("IBAN válido fica guardado e formatado", strip(r.html).includes("AO15 0040 0000 1234 5678 1017 4"));
r = await bob.replay(alice, B, 'name="iban"', { holder: "Bob", iban: "AO15004000001234567810174" });
check("outro utilizador não muda a conta da organização", r.html.includes("Organização não encontrada"));
r = await alice.get("/admin/payouts");
check("organizador sem permissão não vê os repasses", r.status === 404 || !strip(r.html).includes("Repasses aos organizadores"));
const admin = new Browser();
await admin.submit("/login", "password", { email: "admin@camps.local", password: "camps-admin" });
r = await admin.get("/admin/payouts");
check("administrador vê o evento na fila de repasses", strip(r.html).includes(`Torneio X ${stamp}`) && /Liga X Lda/.test(strip(r.html)), strip(r.html).slice(0, 300));
// Formulário de repasse da linha deste evento (o primeiro que aparece depois do nome dele na fila).
const payoutForm = (html) =>
  (html.match(/<form[\s\S]*?<\/form>/g) ?? [])
    .filter((form) => form.includes('name="reference"'))
    .findIndex((form) => html.indexOf(form) > html.indexOf(`Torneio X ${stamp}`));
r = await admin.get("/admin/payouts");
r = await admin.submit("/admin/payouts", 'name="reference"', { amount: "600", reference: "TRF-001" }, payoutForm(r.html));
check("repasse acima do saldo é recusado", r.html.includes("passa do saldo"));
r = await admin.get("/admin/payouts");
await admin.submit("/admin/payouts", 'name="reference"', { amount: "300", reference: "TRF-001" }, payoutForm(r.html));
r = await alice.get(B);
check("organizador vê a transferência e o saldo que falta", /TRF-001/.test(strip(r.html)) && /Saldo a transferir 200,00\sKz/.test(strip(r.html)), strip(r.html).slice(0, 600));

// Pesagem: gravar e apagar
const W = `${E}/weigh-in`;
await alice.submit(W, 'name="weight"', { weight: "70" });
r = await alice.get(W);
check("pesagem gravada", /70 kg · aprovado/.test(strip(r.html)));
await alice.submit(W, 'aria-label="Apagar pesagem"');
r = await alice.get(W);
check("pesagem apagada", !/70 kg · aprovado/.test(strip(r.html)) && /0 \/ 1 pesados/.test(strip(r.html)), strip(r.html).slice(0, 400));

// Outro utilizador a reenviar formulários do organizador
const P = `${E}/payments`;
r = await bob.replay(alice, P, "Devolver", { reason: "ataque", manual: "1" });
check("outro utilizador não reembolsa", r.html.includes("Pagamento não encontrado"), r.html.slice(0, 200));
r = await bob.replay(alice, D, 'name="code"', { code: "BOB100", kind: "percent", value: "100", maxUses: "", expiresOn: "" });
check("outro utilizador não cria cupões", r.html.includes("Evento não encontrado"));
r = await bob.replay(alice, W, 'name="weight"', { weight: "99" });
check("outro utilizador não grava pesagens", r.html.includes("Inscrição não encontrada"));
r = await bob.replay(alice, `${E}/settings`, "Guardar alterações", {
  name: "Pirateado", sport: "Judo", description: "", date: "2027-05-20", endDate: "", registrationOpensOn: "2026-01-01", registrationClosesOn: "2027-05-10", venue: "", city: "", latitude: "", longitude: "",
});
check("outro utilizador não edita o evento", r.html.includes("Evento não encontrado"));
r = await anon.get(`/events/${slug}`);
check("nome do evento intacto", strip(r.html).includes(`Torneio X ${stamp}`) && !strip(r.html).includes("Pirateado"));

// Reembolso manual pelo organizador
r = await alice.submit(P, "Devolver", { reason: "Desistência", manual: "1" });
r = await alice.get(P);
check("reembolso manual registado", /Reembolsado/.test(strip(r.html)) && /Devolvido fora da plataforma/.test(strip(r.html)), strip(r.html).slice(0, 400));
r = await carol.get(regPath);
check("atleta vê o reembolso", /cancelada e reembolsada/.test(strip(r.html)));
r = await alice.get(B);
check("depois do reembolso a taxa mantém-se e o organizador fica a dever", /Em dívida à Camps 800,00\sKz/.test(strip(r.html)), strip(r.html).slice(0, 600));

// Cronómetro: reiniciar
await alice.submit(`${E}/scoreboard`, 'placeholder="Área 1"', { name: "Área 1" });
for (const [firstName, lastName] of [["Um", "Lutador"], ["Dois", "Lutador"]]) {
  await alice.submit(`${E}/divisions/${divId}`, 'name="firstName"', { firstName, lastName, birthDate: "1997-01-05", academyName: "" });
}
await alice.submit(`${E}/brackets`, "Gerar chaves em falta", { type: "SINGLE_ELIMINATION" });
r = await alice.get(`${E}/scoreboard`);
const control = r.html.match(/\/manage\/matches\/\w+\/scoreboard/)?.[0];
const matId = r.html.match(/href="\/scoreboard\/(\w+)"/)?.[1];
// Evento de judo: as regras IJF ficam-se pelos 4 minutos.
await alice.submit(control, 'name="matId"', { matId, durationSeconds: "240" });
await alice.submit(control, 'name="clock"', { clock: "start" });
await new Promise((resolve) => setTimeout(resolve, 1200));
await alice.submit(control, 'name="clock"', { clock: "reset" });
const board = (await (await fetch(`${BASE}/api/mats/${matId}/scoreboard`)).json()).scoreboard;
check("reiniciar põe o cronómetro a zeros e parado", board?.clock.remainingMs === 240000 && board.clock.startedAt === null, JSON.stringify(board?.clock));
r = await anon.get(`/scoreboard/${matId}`);
check("ecrã de TV abre", r.status === 200);
r = await anon.get(`/overlay/${matId}`);
check("sobreposição abre", r.status === 200);

// Rotas de pagamento
r = await anon.get("/api/payments/paypal/return?token=NAO-EXISTE");
check("retorno PayPal desconhecido manda para as inscrições", r.status >= 300 && r.status < 400 && r.location?.endsWith("/registrations"), `${r.status} ${r.location}`);
r = await anon.get("/api/payments/paypal/cancel?payment=nao-existe");
check("cancelamento PayPal desconhecido manda para as inscrições", r.status >= 300 && r.status < 400 && r.location?.endsWith("/registrations"), `${r.status} ${r.location}`);
let res = await fetch(`${BASE}/api/payments/multicaixa-express/callback`, { method: "POST", body: JSON.stringify({ id: "999999" }), headers: { "content-type": "application/json" } });
check("callback Multicaixa com id desconhecido responde 204", res.status === 204, `${res.status}`);
res = await fetch(`${BASE}/api/payments/multicaixa-express/callback`, { method: "POST", body: "lixo" });
check("callback Multicaixa com corpo inválido responde 204", res.status === 204, `${res.status}`);
res = await fetch(`${BASE}/api/mats/nao-existe/scoreboard`);
check("placar de área inexistente responde 404", res.status === 404);

// Filtros e pesquisas públicas
r = await anon.get(`/events?sport=Judo`);
check("filtro por modalidade", strip(r.html).includes(`Torneio X ${stamp}`) && !strip(r.html).includes("Copa Camps de Jiu-Jitsu"));
r = await anon.get(`/events?city=Benguela`);
check("filtro por cidade", strip(r.html).includes(`Torneio X ${stamp}`) && !strip(r.html).includes("Taça de Karaté do Huambo"));
r = await anon.get(`/events?from=2027-05-01&to=2027-05-31`);
check("filtro por datas", strip(r.html).includes(`Torneio X ${stamp}`) && !strip(r.html).includes("Copa Camps de Jiu-Jitsu"));
r = await anon.get(`/events?sort=popular`);
check("ordenar por popularidade abre", r.status === 200 && /Copa Camps/.test(strip(r.html)));
r = await anon.get(`/academies?q=kimura`);
check("pesquisa de academias", /Kimura Luanda/.test(strip(r.html)) && !/Palanca BJJ/.test(strip(r.html)));
r = await anon.get(`/athletes?q=lutador`);
check("pesquisa de atletas", /Um Lutador/.test(strip(r.html)) && !/Edson/.test(strip(r.html)));

// Cancelar o evento
r = await alice.submit(`${E}/settings`, 'name="confirm"', { confirm: "sim" });
check("cancelar sem a palavra de confirmação é recusado", r.html.includes("Escreva CANCELAR"));
await alice.submit(`${E}/settings`, 'name="confirm"', { confirm: "CANCELAR" });
r = await alice.get(E);
check("evento cancelado fica marcado como cancelado", /Cancelado/.test(strip(r.html)));
r = await anon.get(`/events?q=${encodeURIComponent(`Torneio X ${stamp}`)}`);
check("evento cancelado sai da lista pública", !strip(r.html).includes(`Torneio X ${stamp}`));
r = await carol.get(reg);
check("evento cancelado já não aceita inscrições", !r.html.includes('name="athleteId"'), strip(r.html).slice(0, 200));

// Plano Federação: criação, ativação pela Camps, organizações, academias, filiação paga e eventos que a exigem
r = await alice.submit("/manage", "Criar federação", { name: `Fed X ${stamp}`, sport: "Judo" });
const F = r.location ? new URL(r.location, BASE).pathname : "";
check("federação criada abre o painel dela", /^\/manage\/federations\/\w+$/.test(F), `${r.status} ${r.location}`);
const fedId = F.split("/").pop();
const fedSlug = `fed-x-${stamp}`;
r = await anon.get(`/f/${fedSlug}`);
check("federação sem plano ativo não aparece ao público", !strip(r.html).includes(`Fed X ${stamp}`));
r = await alice.get(`${F}/organizers`);
check("sem plano ativo não se autorizam organizações", /precisa de um plano ativo/.test(strip(r.html)) && !r.html.includes('name="organizerSlug"'));
r = await alice.get("/admin/federations");
check("organizador não vê a administração das federações", !strip(r.html).includes("Planos e quotas"));
const fedForm = (html, field) =>
  (html.match(/<form[\s\S]*?<\/form>/g) ?? [])
    .filter((form) => form.includes(`name="${field}"`))
    .findIndex((form) => html.indexOf(form) > html.indexOf(`Fed X ${stamp}`));
r = await admin.get("/admin/federations");
await admin.submit("/admin/federations", 'name="plan"', { plan: "PREMIUM", until: "2027-12-31" }, fedForm(r.html, "plan"));
r = await anon.get(`/f/${fedSlug}`);
check("depois de ativada, a página pública aparece", r.status === 200 && strip(r.html).includes(`Fed X ${stamp}`), strip(r.html).slice(0, 200));

r = await alice.submit(`${F}/organizers`, 'name="organizerSlug"', { organizerSlug: "nao-existe" });
check("identificador de organização desconhecido é recusado", r.html.includes("Não há nenhuma organização"));
await alice.submit(`${F}/organizers`, 'name="organizerSlug"', { organizerSlug: `liga-x-${stamp}` });
r = await alice.get(`${F}/organizers`);
check("organização autorizada aparece na lista", strip(r.html).includes(`Liga X ${stamp}`));
await alice.submit(`${F}/plans`, 'name="months"', { name: "Sénior", price: "3000", months: "12", maxAge: "" });
await alice.submit(`${F}/academies`, 'name="validUntil"', { academyName: `Academia Fed ${stamp}`, validUntil: "2027-06-30" });
await alice.submit(`${F}/news`, 'name="title"', { title: "Abertura da época", body: "A época abre com o Open de Judo. Filiações já disponíveis." });
r = await anon.get(`/f/${fedSlug}/academies`);
check("academia filiada aparece na página pública", strip(r.html).includes(`Academia Fed ${stamp}`));
r = await anon.get(`/f/${fedSlug}`);
check("notícia aparece na página pública", strip(r.html).includes("Abertura da época"));
r = await bob.replay(alice, `${F}/plans`, 'name="months"', { name: "Pirata", price: "1", months: "12", maxAge: "" });
check("outro utilizador não cria planos na federação", r.html.includes("Federação não encontrada"));

// Evento sob a federação a exigir filiação
r = await alice.submit("/manage/events/new", 'name="date"', {
  organizerId, name: `Open Fed ${stamp}`, sport: "Judo", date: "2027-06-20", registrationClosesOn: "2027-06-10", venue: "Pavilhão", city: "Luanda", description: "",
});
const E2 = new URL(r.location, BASE).pathname;
await alice.submit(`${E2}/divisions`, 'name="belt"', { gender: "MALE", ageGroup: "Adulto", belt: "Azul", weightClass: "Leve", maxWeightKg: "73", price: "1000" });
const div2 = (await alice.get(`${E2}/divisions`)).html.match(new RegExp(`${E2}/divisions/(\\w+)`))?.[1];
await alice.submit(E2, "Publicar evento");
await alice.submit(`${E2}/settings`, 'name="federationId"', { federationId: fedId, requiresMembership: "1" });
const reg2 = `/events/open-fed-${stamp}/divisions/${div2}/register`;
r = await anon.get(`/events/open-fed-${stamp}`);
check("evento mostra que exige filiação na federação", strip(r.html).includes(`Exige filiação na Fed X ${stamp}`), strip(r.html).slice(0, 300));
const fedAthlete = { athleteId: "", firstName: "Nzuzi", lastName: "Fed", birthDate: "1996-03-03", academyName: "", mobile: "", provider: "SIMULATOR" };
r = await carol.submit(reg2, 'name="athleteId"', fedAthlete);
check("atleta sem filiação é recusado no evento", r.html.includes("exige filiação ativa"), strip(r.html).slice(0, 300));

r = await carol.get(`/f/${fedSlug}/filiacao`);
const planId = r.html.match(/name="planId"[\s\S]*?<option value="(\w+)"/)?.[1];
r = await carol.submit(`/f/${fedSlug}/filiacao`, 'name="planId"', { planId, ...fedAthlete, gender: "MALE" });
const membershipPath = r.location ? new URL(r.location, BASE).pathname : "";
check("filiação criada leva à página dela", /^\/memberships\/\w+$/.test(membershipPath), `${r.status} ${r.location}`);
await carol.submit(membershipPath, "Simular aprovado");
r = await carol.get(membershipPath);
check("quota paga deixa a filiação em dia", /Filiação em dia até/.test(strip(r.html)), strip(r.html).slice(0, 300));
r = await carol.get(`/dev/mailbox?to=${encodeURIComponent(`cx${stamp}@t.local`)}`);
check("e-mail de filiação ativa chega", r.html.includes(`Filiação ativa: Fed X ${stamp}`) && r.html.includes(membershipPath));
r = await carol.get("/registrations");
check("as minhas inscrições lista a filiação", strip(r.html).includes(`Fed X ${stamp}`));
r = await carol.get(reg2);
const fedAthleteId = r.html.match(/<option[^>]*value="(\w+)"[^>]*>Nzuzi/)?.[1];
r = await carol.submit(reg2, 'name="athleteId"', { ...fedAthlete, athleteId: fedAthleteId });
check("atleta filiado já se inscreve no evento", r.status === 303 && /^\/registrations\/\w+$/.test(new URL(r.location, BASE).pathname), strip(r.html).slice(0, 300));

r = await alice.get(`${F}/members`);
check("federação vê o atleta filiado", /Nzuzi Fed/.test(strip(r.html)) && /Em dia/.test(strip(r.html)));
await alice.submit(`${F}/payouts`, 'name="iban"', { holder: "Fed X", iban: "AO15004000001234567810174" });
r = await alice.get(`${F}/payouts`);
check("quotas recebidas e saldo da federação", /Quotas recebidas 3\s000,00\sKz/.test(strip(r.html)) && /Saldo a receber 3\s000,00\sKz/.test(strip(r.html)), strip(r.html).slice(0, 500));
r = await admin.get("/admin/federations");
await admin.submit("/admin/federations", 'name="reference"', { amount: "3000", reference: "FED-001" }, fedForm(r.html, "reference"));
r = await alice.get(`${F}/payouts`);
check("repasse das quotas registado", /FED-001/.test(strip(r.html)) && /Saldo a receber 0,00\sKz/.test(strip(r.html)), strip(r.html).slice(0, 500));

// Reembolso de quotas: automático (pelo provedor) e manual
const M = `${F}/members`;
r = await bob.replay(alice, M, "Devolver", { reason: "ataque", manual: "1" });
check("outro utilizador não reembolsa quotas", r.html.includes("Pagamento não encontrado"));
r = await alice.submit(M, "Devolver", { reason: "", manual: "0" });
check("reembolso de quota sem motivo é recusado", r.html.includes("motivo do reembolso"));
await alice.submit(M, "Devolver", { reason: "Lesão antes da época", manual: "0" });
r = await alice.get(M);
check("quota reembolsada pelo provedor fica marcada com o motivo", /Reembolsada/.test(strip(r.html)) && /Devolvido pelo provedor · Lesão antes da época/.test(strip(r.html)), strip(r.html).slice(0, 500));
r = await carol.get(membershipPath);
check("atleta vê a filiação cancelada e reembolsada", /Filiação cancelada e reembolsada/.test(strip(r.html)) && /3\s000,00\sKz devolvidos/.test(strip(r.html)), strip(r.html).slice(0, 300));
r = await carol.get(`/dev/mailbox?to=${encodeURIComponent(`cx${stamp}@t.local`)}`);
check("e-mail de reembolso da quota chega", r.html.includes(`Reembolso da quota: Fed X ${stamp}`));
r = await alice.get(`${F}/payouts`);
check("reembolso depois do repasse deixa a federação em dívida", /Reembolsado 3\s000,00\sKz/.test(strip(r.html)) && /Em dívida à Camps 3\s000,00\sKz/.test(strip(r.html)), strip(r.html).slice(0, 500));
r = await carol.submit(reg2, 'name="athleteId"', { ...fedAthlete, athleteId: fedAthleteId });
check("depois do reembolso, o atleta já não cumpre a filiação exigida", r.html.includes("exige filiação ativa"), strip(r.html).slice(0, 300));

r = await carol.submit(`/f/${fedSlug}/filiacao`, 'name="planId"', { planId, ...fedAthlete, athleteId: fedAthleteId, gender: "MALE" });
const rejoinPath = r.location ? new URL(r.location, BASE).pathname : "";
check("atleta reembolsado pode voltar a filiar-se", /^\/memberships\/\w+$/.test(rejoinPath) && rejoinPath !== membershipPath, `${r.status} ${r.location}`);
await carol.submit(rejoinPath, "Simular aprovado");
r = await alice.get(M);
const refundIndex = (r.html.match(/<form[\s\S]*?<\/form>/g) ?? []).filter((form) => form.includes("Devolver")).length - 1;
await alice.submit(M, "Devolver", { reason: "Pago em duplicado", manual: "1" }, Math.max(0, refundIndex));
r = await alice.get(M);
check("reembolso manual de quota fica registado", /Devolvido fora da plataforma · Pago em duplicado/.test(strip(r.html)), strip(r.html).slice(0, 500));
r = await admin.get("/admin/federations");
check("administração mostra a dívida da federação", /reembolsado 6\s000,00\sKz/.test(strip(r.html)) && /em dívida 3\s000,00\sKz/.test(strip(r.html)), strip(r.html).slice(0, 600));

console.log(failures ? `\n${failures} falha(s)` : "\ntudo certo");
process.exit(failures ? 1 : 0);
