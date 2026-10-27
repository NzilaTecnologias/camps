// Equipa da organização com papéis, dupla eliminação e programação das lutas por área.
// Precisa do servidor de desenvolvimento sem RESEND_API_KEY (os e-mails ficam em /dev/mailbox).
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
  async signup(fields) {
    const res = await this.submit("/signup", "password", { terms: "on", ...fields });
    const { html } = await this.get(`/dev/mailbox?to=${encodeURIComponent(fields.email)}`);
    const link = html.match(/href="[^"]*(\/verify-email\?token=[^"]+)"/)?.[1];
    if (!link) throw new Error(`não chegou o e-mail de confirmação para ${fields.email}`);
    await this.submit(decode(link), "token");
    return res;
  }
  /** O HTML do formulário da página `path` que contém `marker` (sem os scripts do React). */
  async form(path, marker, nth = 0) {
    const html = (await this.get(path)).html.replace(/<script[\s\S]*?<\/script>/g, "");
    return (html.match(/<form[\s\S]*?<\/form>/g) ?? []).filter((f) => f.includes(marker))[nth];
  }
  /** Envia, com a sessão deste navegador, um formulário que só `other` consegue ver. */
  async replay(other, path, marker, fields = {}) {
    return this.submit(path, marker, fields, 0, await other.form(path, marker));
  }
  async submit(path, marker, fields = {}, nth = 0, found = null) {
    const form = found ?? (await this.form(path, marker, nth));
    if (!form) throw new Error(`formulário com "${marker}" não encontrado em ${path}`);
    const body = new FormData();
    for (const input of form.match(/<input[^>]*type="hidden"[^>]*>/g) ?? []) {
      const name = input.match(/name="([^"]*)"/)?.[1];
      if (name && !(decode(name) in fields)) body.append(decode(name), decode(input.match(/value="([^"]*)"/)?.[1] ?? ""));
    }
    for (const [name, value] of Object.entries(fields)) body.append(name, value);
    const res = await this.request(path, { method: "POST", body });
    return { status: res.status, location: res.headers.get("location"), html: await res.text() };
  }
}

const stamp = Date.now();
const day = (offset) => new Date(Date.now() + offset * 86_400_000).toISOString().slice(0, 10);
const mailbox = async (browser, email) => (await browser.get(`/dev/mailbox?to=${encodeURIComponent(email)}`)).html;
const NO_ACCESS = "não dá acesso a esta secção";
// Na resposta de um formulário sem JavaScript, a mensagem de erro vem nos dados do React.
const refused = (res, message) => res.html.includes(message);
// O React separa "#" e o número da luta com um comentário: "#<!-- -->1".
const slot = (sequence, time) => new RegExp(`# ${sequence} ${time}`);

// ---------------------------------------------------------------- Equipa e papéis
const owner = new Browser();
const staff = new Browser();
const manager = new Browser();
const ownerEmail = `dono${stamp}@teste.local`;
const staffEmail = `mesario${stamp}@teste.local`;
const managerEmail = `gestor${stamp}@teste.local`;
await owner.signup({ name: "Dona Teste", email: ownerEmail, password: "senha-da-dona-1" });
await staff.signup({ name: "Mesário Teste", email: staffEmail, password: "senha-do-mesario-1" });
await manager.signup({ name: "Gestor Teste", email: managerEmail, password: "senha-do-gestor-1" });

await owner.submit("/manage", 'name="name"', { name: `Liga Equipa ${stamp}` });
let r = await owner.get("/manage");
const organizerId = r.html.match(/\/manage\/organizers\/(\w+)\/team/)?.[1];
check("o painel liga à equipa da organização", Boolean(organizerId));
const teamPath = `/manage/organizers/${organizerId}/team`;

r = await owner.submit(teamPath, 'name="role"', { email: `ninguem${stamp}@teste.local`, role: "STAFF" });
check("e-mail sem conta é recusado", refused(r, "Não há nenhuma conta com esse e-mail"));
await owner.submit(teamPath, 'name="role"', { email: staffEmail, role: "STAFF" });
await owner.submit(teamPath, 'name="role"', { email: managerEmail, role: "ADMIN" });
r = await owner.get(teamPath);
let page = strip(r.html);
check("a equipa mostra dono, gestor e mesário", page.includes("Dona Teste") && page.includes("Gestor Teste") && page.includes("Mesário Teste"), page.slice(0, 400));
check("quem entra na equipa recebe um e-mail", (await mailbox(staff, staffEmail)).includes(`Entrou na equipa de Liga Equipa ${stamp}`));
r = await owner.submit(teamPath, "Sair da organização");
check("o único dono não pode sair", refused(r, "precisa de pelo menos um dono"));
r = await staff.get(teamPath);
check("o mesário vê a equipa mas não a muda", strip(r.html).includes("Só o dono acrescenta pessoas") && !r.html.includes('name="role"'));

// O evento, com duas categorias e duas áreas.
r = await owner.get("/manage/events/new");
r = await owner.submit("/manage/events/new", 'name="date"', {
  organizerId, name: `Open Equipa ${stamp}`, sport: "Jiu-Jitsu", date: day(2), registrationClosesOn: day(1), venue: "Pavilhão", city: "Luanda", description: "",
});
const eventPath = new URL(r.location, BASE).pathname;
await owner.submit(`${eventPath}/divisions`, 'name="belt"', { gender: "MALE", ageGroup: "Adulto", belt: "Azul", weightClass: "Leve", maxWeightKg: "76", price: "0" });
await owner.submit(`${eventPath}/divisions`, 'name="belt"', { gender: "MALE", ageGroup: "Adulto", belt: "Azul", weightClass: "Pesado", maxWeightKg: "", price: "0" });
r = await owner.get(`${eventPath}/divisions`);
const [lightPath, heavyPath] = [...new Set(r.html.match(new RegExp(`${eventPath}/divisions/\\w+`, "g")))];
const names = ["Ana", "Bela", "Cris", "Dina", "Eva", "Fátima"];
for (const firstName of names) await owner.submit(lightPath, 'name="firstName"', { firstName, lastName: "Leve", birthDate: "1998-03-03", academyName: "" });
for (const firstName of names.slice(0, 3)) await owner.submit(heavyPath, 'name="firstName"', { firstName, lastName: "Pesado", birthDate: "1995-05-05", academyName: "" });
await owner.submit(`${eventPath}/scoreboard`, "Nova área de luta", { name: "Tatami A" });
await owner.submit(`${eventPath}/scoreboard`, "Nova área de luta", { name: "Tatami B" });

// O mesário só abre o dia da prova.
r = await staff.get("/manage");
check("o mesário vê o evento da organização", r.html.includes(eventPath));
r = await staff.get(eventPath);
page = strip(r.html);
check("o menu do mesário não tem página do evento, pagamentos nem faturação", !r.html.includes(`${eventPath}/settings"`) && !r.html.includes(`${eventPath}/payments"`) && r.html.includes(`${eventPath}/weigh-in"`) && r.html.includes(`${eventPath}/schedule"`));
check("o mesário não vê a receita nem o botão de publicar", !page.includes("Receita líquida") && !page.includes("Publicar evento"));
for (const section of ["settings", "divisions", "discounts", "payments", "billing"]) {
  r = await staff.get(`${eventPath}/${section}`);
  check(`o mesário não abre ${section}`, strip(r.html).includes(NO_ACCESS), strip(r.html).slice(0, 200));
}
r = await staff.get(`${eventPath}/weigh-in`);
check("o mesário abre a pesagem", r.status === 200 && !strip(r.html).includes(NO_ACCESS));
r = await staff.get("/manage/events/new");
check("o mesário não cria eventos", strip(r.html).includes("peça ao dono da sua organização o papel de gestor"));
r = await staff.get(lightPath);
check("o mesário vê a categoria sem os formulários de gestão", r.status === 200 && !r.html.includes('name="firstName"') && !r.html.includes("Gerar chave"));

// O gestor gere o evento mas não a conta dos repasses.
r = await manager.get(`${eventPath}/settings`);
check("o gestor abre a página do evento", !strip(r.html).includes(NO_ACCESS) && r.html.includes('name="name"'));
r = await manager.get(`${eventPath}/billing`);
check("o gestor vê o extrato mas não muda o IBAN", strip(r.html).includes("Só o dono da organização muda a conta") && !r.html.includes('name="iban"'));
r = await manager.get(teamPath);
check("o gestor não gere a equipa", !r.html.includes('name="role"'));

// ---------------------------------------------------------------- Dupla eliminação
await owner.submit(lightPath, 'name="type"', { type: "DOUBLE_ELIMINATION" });
r = await owner.get(lightPath);
page = strip(r.html);
check("a dupla eliminação mostra a chave principal, a dos vencidos e a final", page.includes("Chave principal") && page.includes("Chave dos vencidos") && page.includes("Final dos vencidos"), page.slice(0, 300));
r = await owner.submit(heavyPath, 'name="type"', { type: "DOUBLE_ELIMINATION" });
r = await owner.get(heavyPath);
check("dupla eliminação com 3 atletas", strip(r.html).includes("Chave dos vencidos"));

// ---------------------------------------------------------------- Programação
r = await owner.get(`${eventPath}/schedule`);
const matIds = [...new Set([...r.html.matchAll(/name="startsAt-(\w+)"/g)].map((m) => m[1]))];
check("a programação tem um início por área", matIds.length === 2, JSON.stringify(matIds));
r = await owner.submit(`${eventPath}/schedule`, 'name="matchMinutes"', { matchMinutes: "1" });
check("minutos por luta fora do intervalo são recusados", refused(r, "Os minutos por luta vão de 2 a 60"));
await owner.submit(`${eventPath}/schedule`, 'name="matchMinutes"', {
  matchMinutes: "6",
  [`startsAt-${matIds[0]}`]: `${day(2)}T09:00`,
  [`startsAt-${matIds[1]}`]: `${day(2)}T10:00`,
});
r = await owner.submit(`${eventPath}/schedule`, "Gerar programação");
check("sem áreas escolhidas não há programação", refused(r, "Escolha a área de pelo menos uma categoria"));
await owner.submit(`${eventPath}/schedule`, "Repartir automaticamente");
r = await owner.submit(`${eventPath}/schedule`, "Gerar programação");
r = await owner.get(`${eventPath}/schedule`);
page = strip(r.html);
check("a programação começa às 09:00 numa área e às 10:00 na outra", slot(1, "09:00").test(page) && slot(1, "10:00").test(page), page.slice(0, 600));
check("as lutas seguintes vêm de 6 em 6 minutos", slot(2, "09:06").test(page) || slot(2, "10:06").test(page));
r = await staff.get(`${eventPath}/schedule`);
check("o mesário vê a programação mas não a muda", slot(1, "\\d\\d:\\d\\d").test(strip(r.html)) && !r.html.includes('name="matchMinutes"'));

await owner.submit(eventPath, "Publicar evento");
const slug = (await owner.get(eventPath)).html.match(/href="\/events\/([\w-]+)"/)?.[1];
r = await new Browser().get(`/events/${slug}/schedule`);
page = strip(r.html);
check("programa público com as duas áreas e as horas", r.status === 200 && page.includes("Tatami A") && page.includes("Tatami B") && /09:00/.test(page), page.slice(0, 300));
r = await new Browser().get(`/events/${slug}`);
check("a página do evento liga à programação", r.html.includes(`/events/${slug}/schedule`));
// O evento acabou de ser publicado: é o primeiro da lista, embora seja daqui a dois dias.
r = await new Browser().get("/events");
const firstEvent = r.html.match(/href="\/events\/([\w-]+)"/)?.[1];
check("a lista de eventos mostra primeiro o publicado há menos tempo", firstEvent === slug, `${firstEvent} ≠ ${slug}`);
r = await staff.get(`${eventPath}/scoreboard`);
check("as lutas prontas mostram a hora prevista", /prevista \d\d:\d\d/.test(strip(r.html)));

// O mesário joga a chave de dupla eliminação até ao fim, sempre com vitória do canto vermelho.
let played = 0;
for (; played < 40; played++) {
  const form = await staff.form(lightPath, 'name="winnerId"');
  if (!form) break;
  const winnerId = form.match(/name="winnerId" value="([^"]+)"/)?.[1] ?? form.match(/value="([^"]+)"[^>]*name="winnerId"/)?.[1];
  const res = await staff.submit(lightPath, 'name="winnerId"', { winnerId });
  if (res.status !== 303 && res.status !== 200) break;
}
r = await staff.get(lightPath);
page = strip(r.html);
check("a dupla eliminação de 6 atletas joga-se até ao fim", played >= 9 && !r.html.includes('name="winnerId"'), `${played} lutas`);
check("a chave fecha com pódio", page.includes("Pódio"), page.slice(-400));
r = await new Browser().get(`/events/${slug}/schedule`);
check("lutas terminadas aparecem como terminadas no programa", strip(r.html).includes("Terminada"));

// Perfil de um atleta da chave jogada: registo, vitórias por método e cada luta com adversário e ronda.
r = await new Browser().get(`/events/${slug}/divisions/${lightPath.split("/").pop()}`);
const athleteIds = [...new Set([...r.html.matchAll(/href="\/athletes\/(\w+)"/g)].map((m) => m[1]))];
check("a página da categoria liga aos perfis dos atletas", athleteIds.length === 6, JSON.stringify(athleteIds));
r = await new Browser().get(`/athletes/${athleteIds[0]}`);
page = strip(r.html);
const recordMatch = page.match(/(\d+)\s*–\s*(\d+) Registo/);
check("o perfil mostra o registo de vitórias e derrotas", Boolean(recordMatch) && Number(recordMatch[1]) + Number(recordMatch[2]) >= 2, page.slice(0, 400));
check("o perfil reparte as vitórias e derrotas por método", page.includes("Vitórias por método") && page.includes("Derrotas por método"));
check("o historial tem o evento e as rondas da dupla eliminação", page.includes(`Open Equipa ${stamp}`) && /Final|Chave dos vencidos|Semifinal|Quartos de final/.test(page));
const opponents = [...r.html.matchAll(/href="\/athletes\/(\w+)"/g)].map((m) => m[1]).filter((id) => id !== athleteIds[0]);
check("cada luta liga ao perfil do adversário", opponents.length >= 2);

// ---------------------------------------------------------------- Imagem do evento
// PNG de 1×1 píxel.
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");
const settingsPath = `${eventPath}/settings`;
const eventId = eventPath.split("/").pop();
const mediaPath = (html) => html.match(new RegExp(`/media/events/${eventId}/[a-z0-9-]+\\.(?:png|jpg|webp)`))?.[0];
r = await owner.submit(settingsPath, 'name="image"', { image: new File([Buffer.from("isto não é uma imagem")], "falsa.png", { type: "image/png" }) });
check("um ficheiro que não é imagem é recusado, mesmo chamado .png", refused(r, "A imagem tem de ser JPEG, PNG ou WebP"));
r = await staff.replay(owner, settingsPath, 'name="image"', { image: new File([PNG], "evento.png", { type: "image/png" }) });
check("o mesário não muda a imagem", refused(r, "Evento não encontrado"));
await owner.submit(settingsPath, 'name="image"', { image: new File([PNG], "evento.png", { type: "image/png" }) });
r = await owner.get(settingsPath);
const imagePath = mediaPath(r.html);
check("a imagem carregada aparece na página do evento do painel", Boolean(imagePath), strip(r.html).slice(0, 200));
let res = await fetch(BASE + imagePath);
check(
  "a imagem é guardada tratada, em WebP, e servida com cache longa",
  imagePath?.endsWith(".webp") && res.status === 200 && res.headers.get("content-type") === "image/webp" && /immutable/.test(res.headers.get("cache-control") ?? ""),
  `${imagePath} ${res.status} ${res.headers.get("content-type")}`,
);
r = await owner.submit(settingsPath, 'name="image"', { image: new File([Buffer.concat([PNG.subarray(0, 40), Buffer.alloc(200, 7)])], "partida.png", { type: "image/png" }) });
check("uma imagem partida é recusada", refused(r, "Não foi possível ler a imagem"));
r = await new Browser().get(`/events/${slug}`);
check("a página pública mostra a imagem do evento", r.html.includes(encodeURIComponent(imagePath)) || r.html.includes(imagePath));
res = await fetch(`${BASE}/media/events/${eventId}/..%2F..%2Fpackage.json`);
check("o endereço das imagens não sai da pasta delas", res.status === 404);
await owner.submit(settingsPath, "Tirar a imagem");
r = await owner.get(settingsPath);
check("tirar a imagem volta à fotografia da modalidade", !mediaPath(r.html) && strip(r.html).includes("Fotografia da modalidade"));
check("o ficheiro da imagem tirada é apagado", (await fetch(BASE + imagePath)).status === 404);

// ---------------------------------------------------------------- Tirar da equipa
await owner.submit(teamPath, "Tirar da equipa", {}, 1);
r = await owner.get(teamPath);
page = strip(r.html);
const staffGone = !page.includes("Mesário Teste");
const managerGone = !page.includes("Gestor Teste");
check("tirar alguém da equipa", staffGone !== managerGone, page.slice(0, 300));
r = await (staffGone ? staff : manager).get(eventPath);
// O painel do evento responde dentro de um Suspense: o 404 chega nos dados do React, não no estado HTTP.
check(
  "quem sai da equipa deixa de abrir o evento",
  (r.status === 404 || r.html.includes("NEXT_HTTP_ERROR_FALLBACK;404")) && !strip(r.html).includes(`Open Equipa ${stamp}`),
  `${r.status}`,
);

console.log(failures ? `\n${failures} falha(s)` : "\ntudo certo");
process.exit(failures ? 1 : 0);
