// Exercita o app pelo HTTP, enviando os formulários como um navegador sem JavaScript.
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
const alice = new Browser();
const bob = new Browser();

// Acesso sem login
let r = await alice.get("/manage");
check("painel sem login redireciona para /login e guarda o destino", r.status === 307 && r.location?.endsWith("/login?next=%2Fmanage"), `${r.status} ${r.location}`);

// Cadastro
r = await alice.submit("/signup", "password", { name: "A", email: "x", password: "curta" });
check("cadastro inválido mostra erro", r.html.includes("Informe seu nome"), strip(r.html).slice(0, 200));
r = await alice.submit("/signup", "password", { name: "Alice Teste", email: `alice${stamp}@teste.local`, password: "senha-da-alice" });
check("cadastro redireciona para a página inicial", r.status === 303 && new URL(r.location, BASE).pathname === "/", `${r.status} ${r.location}`);
check("cadastro grava cookie de sessão", alice.cookies.has("camps_session"));
r = await bob.submit("/signup", "password", { name: "Outra", email: `alice${stamp}@teste.local`, password: "outra-senha-1" });
check("e-mail repetido é recusado", r.html.includes("existe uma conta com este e-mail"));

// Organização e evento
r = await alice.get("/manage");
check("painel abre logado", r.status === 200 && /precisa de uma organização/.test(strip(r.html)), strip(r.html).slice(0, 200));
await alice.submit("/manage", 'name="name"', { name: `Liga Teste ${stamp}` });
r = await alice.get("/manage");
check("organização criada aparece no painel", strip(r.html).includes(`Liga Teste ${stamp}`));

const newEvent = await alice.get("/manage/events/new");
const organizerId = newEvent.html.match(/<option value="([^"]+)"/)?.[1];
r = await alice.submit("/manage/events/new", 'name="date"', {
  organizerId, name: `Open Teste ${stamp}`, sport: "Jiu-Jitsu", date: "2027-03-20", registrationClosesOn: "2027-03-25", venue: "", city: "Rio", description: "",
});
check("inscrições depois do evento são recusadas", r.html.includes("o dia do evento"), strip(r.html).slice(0, 300));
r = await alice.submit("/manage/events/new", 'name="date"', {
  organizerId, name: `Open Teste ${stamp}`, sport: "Jiu-Jitsu", date: "2027-03-20", registrationClosesOn: "2027-03-13", venue: "Arena", city: "Rio", description: "",
});
const eventPath = r.location ? new URL(r.location, BASE).pathname : "";
check("evento criado redireciona para a página dele", r.status === 303 && /^\/manage\/events\/\w+$/.test(eventPath), `${r.status} ${r.location}`);

r = await alice.get(eventPath);
check("evento nasce como rascunho", /Rascunho/.test(strip(r.html)) && /20 de março de 2027/.test(strip(r.html)), strip(r.html).slice(0, 300));
const slug = `open-teste-${stamp}`;
r = await alice.get(`/events/${slug}`);
check("rascunho não aparece na página pública", !strip(r.html).includes("Categorias"));

// Categoria
r = await alice.submit(eventPath, 'name="belt"', { gender: "FEMALE", ageGroup: "Adulto", belt: "Roxa", weightClass: "Pena", maxWeightKg: "58,5", price: "120,50" });
r = await alice.get(eventPath);
check("categoria criada com nome, peso e preço", /Adulto Feminino Roxa Pena/.test(strip(r.html)) && /até 58.5 kg/.test(strip(r.html)) && /120,50\sKz/.test(strip(r.html)), strip(r.html).slice(0, 500));
const divisionPath = r.html.match(new RegExp(`${eventPath}/divisions/\\w+`))?.[0];

// Chave com poucos atletas
r = await alice.submit(divisionPath, 'name="type"', { type: "SINGLE_ELIMINATION" });
check("chave sem atletas é recusada", r.html.includes("pelo menos 2 competidores"), strip(r.html).slice(0, 300));

// Atletas
const names = [["Ana", "Lima", "Alliance"], ["Bia", "Rocha", "alliance"], ["Carla", "Dias", "Atos"], ["Duda", "Melo", ""]];
for (const [firstName, lastName, academyName] of names) {
  await alice.submit(divisionPath, 'name="firstName"', { firstName, lastName, birthDate: "1998-05-10", academyName });
}
r = await alice.get(divisionPath);
check("4 atletas inscritas", /Inscritos \( ?4 ?\)/.test(strip(r.html)), strip(r.html).slice(0, 400));

// Chave e resultados
await alice.submit(divisionPath, 'name="type"', { type: "SINGLE_ELIMINATION" });
r = await alice.get(divisionPath);
let page = strip(r.html);
check("chave gerada com semifinal, final e bronze", /Semifinal/.test(page) && /Final/.test(page) && /Disputa de 3º lugar/.test(page), page.slice(0, 400));
const semis = (r.html.match(/<form[\s\S]*?<\/form>/g) ?? []).filter((f) => f.includes('name="winnerId"'));
check("duas lutas prontas para resultado", semis.length === 2, `${semis.length}`);
const sameSemi = semis.some((f) => /Venceu\s*(<!-- -->)?\s*Ana/.test(f) && /Venceu\s*(<!-- -->)?\s*Bia/.test(f));
check("atletas da mesma academia ficam em semifinais diferentes", !sameSemi);

// Joga a chave inteira: vence sempre o primeiro botão.
for (let i = 0; i < 4; i++) {
  const current = await alice.get(divisionPath);
  const form = (current.html.match(/<form[\s\S]*?<\/form>/g) ?? []).find((f) => f.includes('name="winnerId"'));
  if (!form) break;
  const winnerId = form.match(/name="winnerId" value="([^"]+)"/)?.[1] ?? form.match(/value="([^"]+)"[^>]*name="winnerId"/)?.[1];
  const marker = form.match(/Venceu[\s\S]*?<\/button>/)[0];
  await alice.submit(divisionPath, marker, { winnerId });
}
r = await alice.get(divisionPath);
page = strip(r.html);
check("pódio fechado com 1º a 4º", [1, 2, 3, 4].every((n) => new RegExp(n + " ?º —").test(page)), page.slice(0, 600));
check("chave disputada não pode ser regerada", /não pode mais ser regerada/.test(page));

// Publicação
await alice.submit(eventPath, "Publicar evento");
r = await alice.get(`/events/${slug}`);
check("evento publicado aparece na página pública", strip(r.html).includes("Adulto Feminino Roxa Pena"), strip(r.html).slice(0, 300));

// Localização no mapa
r = await alice.get(`/events/${slug}`);
check("evento numa cidade desconhecida e sem ponto marcado não mostra mapa", !/Abrir no mapa/.test(strip(r.html)) && /Categorias/.test(strip(r.html)));
r = await alice.submit(eventPath, "Guardar localização", { latitude: "999", longitude: "13.24" });
check("coordenadas impossíveis são recusadas", r.html.includes("Localização no mapa inválida"));
await alice.submit(eventPath, "Guardar localização", { latitude: "-8.8301234", longitude: "13.2401234" });
r = await alice.get(`/events/${slug}`);
check(
  "ponto marcado pelo organizador aparece na página do evento",
  r.html.includes("mlat=-8.830123") && r.html.includes("mlon=13.240123") && !/localização aproximada/.test(strip(r.html)),
  strip(r.html).slice(0, 200),
);
r = await alice.get("/events?view=map");
check("lista de eventos abre o mapa", /Esconder mapa/.test(strip(r.html)) && r.html.includes('aria-label="Mapa dos eventos"'));


// Isolamento entre organizadores
await bob.submit("/signup", "password", { name: "Bob Teste", email: `bob${stamp}@teste.local`, password: "senha-do-bob-1" });
r = await bob.get(eventPath);
check("outro usuário não vê o evento no painel", !strip(r.html).includes(`Open Teste ${stamp}`), strip(r.html).slice(0, 300));
r = await bob.get(divisionPath);
check("outro usuário não vê a categoria no painel", !strip(r.html).includes("Inscrever atleta"));
r = await bob.get("/manage");
check("painel do outro usuário não lista a organização", !strip(r.html).includes(`Liga Teste ${stamp}`));

// Inscrição pelo atleta, com pagamento no simulador
const publicPath = (managePath) => managePath.replace(eventPath, `/events/${slug}`);
const divisionLink = (html, name) =>
  html.match(new RegExp(`href="(${eventPath}/divisions/\\w+)"[^>]*>(?:(?!</a>)[\\s\\S])*?${name}`))?.[1];
await alice.submit(eventPath, 'name="belt"', { gender: "MALE", ageGroup: "Adulto", belt: "Azul", weightClass: "Leve", maxWeightKg: "76", price: "5000" });
await alice.submit(eventPath, 'name="belt"', { gender: "MALE", ageGroup: "Adulto", belt: "Branca", weightClass: "Leve", maxWeightKg: "76", price: "0" });
r = await alice.get(eventPath);
const managedPaidDivision = divisionLink(r.html, "Azul Leve");
const paidDivision = publicPath(managedPaidDivision);
const freeDivision = publicPath(divisionLink(r.html, "Branca Leve"));

const carol = new Browser();
r = await carol.get(`${paidDivision}/register`);
const loginUrl = r.location ? new URL(r.location, BASE) : null;
check("inscrição sem conta manda para o login com o destino", r.status === 307 && loginUrl?.searchParams.get("next") === `${paidDivision}/register`, `${r.status} ${r.location}`);
r = await carol.submit(`/signup?next=${encodeURIComponent(`${paidDivision}/register`)}`, "password", { name: "Carol Teste", email: `carol${stamp}@teste.local`, password: "senha-da-carol" });
check("depois de criar conta volta para a inscrição", r.status === 303 && new URL(r.location, BASE).pathname === `${paidDivision}/register`, `${r.status} ${r.location}`);

r = await carol.get(`${paidDivision}/register`);
check(
  "página de inscrição mostra preço em kwanzas e só os métodos configurados",
  /5\s000,00\sKz/.test(strip(r.html)) && r.html.includes('value="SIMULATOR"') && !r.html.includes('value="MULTICAIXA_EXPRESS"') && !r.html.includes('value="PAYPAL"'),
  strip(r.html).slice(0, 400),
);
const athleteFields = { athleteId: "", firstName: "Kiluanji", lastName: "Neto", birthDate: "1999-04-02", academyName: "Kimura Luanda", mobile: "" };
r = await carol.submit(`${paidDivision}/register`, 'name="athleteId"', { ...athleteFields, provider: "PAYPAL" });
check("método não configurado é recusado", r.html.includes("Escolha um m"), strip(r.html).slice(0, 200));
r = await carol.submit(`${paidDivision}/register`, 'name="athleteId"', { ...athleteFields, firstName: "", provider: "SIMULATOR" });
check("atleta novo sem nome é recusado", r.html.includes("Informe o nome e o apelido"));
r = await carol.submit(`${paidDivision}/register`, 'name="athleteId"', { ...athleteFields, provider: "SIMULATOR" });
const registrationPath = r.location ? new URL(r.location, BASE).pathname : "";
check("inscrição criada leva para a página dela", r.status === 303 && /^\/registrations\/\w+$/.test(registrationPath), `${r.status} ${r.location}`);

r = await carol.get(registrationPath);
check("inscrição fica à espera do pagamento", /Simulador de pagamentos/.test(strip(r.html)) && !/Inscrição confirmada/.test(strip(r.html)), strip(r.html).slice(0, 300));
r = await carol.get(paidDivision);
check("inscrição por pagar não aparece na lista pública", /Inscritos \( ?0 ?\)/.test(strip(r.html)), strip(r.html).slice(0, 300));

await carol.submit(registrationPath, "Simular recusado");
r = await carol.get(registrationPath);
check("pagamento recusado mostra o motivo e deixa tentar de novo", /Recusado no simulador/.test(strip(r.html)) && r.html.includes('name="provider"'), strip(r.html).slice(0, 300));
await carol.submit(registrationPath, 'name="provider"', { provider: "SIMULATOR", mobile: "" });
await carol.submit(registrationPath, "Simular aprovado");
r = await carol.get(registrationPath);
check("pagamento aprovado confirma a inscrição", /Inscrição confirmada · 5\s000,00\sKz pagos/.test(strip(r.html)), strip(r.html).slice(0, 300));
r = await carol.get(paidDivision);
check("atleta pago aparece na lista pública", /Inscritos \( ?1 ?\)/.test(strip(r.html)) && /Kiluanji Neto/.test(strip(r.html)), strip(r.html).slice(0, 300));

r = await carol.get(`${paidDivision}/register`);
const athleteId = r.html.match(/<option[^>]*value="(\w+)"[^>]*>Kiluanji/)?.[1];
r = await carol.submit(`${paidDivision}/register`, 'name="athleteId"', { ...athleteFields, athleteId, provider: "SIMULATOR" });
check("mesmo atleta não se inscreve duas vezes na categoria", r.html.includes("inscrito nesta categoria"), `${athleteId} ${strip(r.html).slice(0, 200)}`);

r = await carol.submit(`${freeDivision}/register`, 'name="athleteId"', { ...athleteFields, athleteId });
r = await carol.get(r.location ? new URL(r.location, BASE).pathname : "/nao-redirecionou");
check("categoria gratuita confirma na hora, sem pagamento", /Inscrição confirmada ?\./.test(strip(r.html)), strip(r.html).slice(0, 300));

r = await carol.get("/registrations");
check("as minhas inscrições lista as duas", (strip(r.html).match(/Kiluanji Neto/g) ?? []).length === 2 && /Confirmada/.test(strip(r.html)), strip(r.html).slice(0, 300));
r = await bob.get(registrationPath);
check("outro utilizador não vê a inscrição alheia", !strip(r.html).includes("Kiluanji"));
r = await alice.get(managedPaidDivision);
check("organizador vê o atleta inscrito no painel", /Kiluanji Neto/.test(strip(r.html)));

const dave = new Browser();
r = await dave.submit("/signup?next=//malicioso.example", "password", { name: "Dave Teste", email: `dave${stamp}@teste.local`, password: "senha-do-dave" });
check("destino externo no login é ignorado", r.status === 303 && new URL(r.location, BASE).href === new URL("/", BASE).href, `${r.status} ${r.location}`);
r = await new Browser().submit("/login", "password", { email: `dave${stamp}@teste.local`, password: "senha-do-dave", next: "/\t/malicioso.example" });
check("destino com tab no login é ignorado", r.status === 303 && new URL(r.location, BASE).href === new URL("/", BASE).href, `${r.status} ${r.location}`);

// Áreas de luta e transmissão em direto
await alice.submit(eventPath, 'placeholder="Área 1"', { name: "Área 1" });
r = await alice.get(eventPath);
const matId = r.html.match(/\/scoreboard\/(\w+)/)?.[1];
check("área criada com ligações para o ecrã de TV e a sobreposição", Boolean(matId) && r.html.includes(`/overlay/${matId}`));
r = await alice.submit(eventPath, 'name="streamUrl"', { streamUrl: "https://malicioso.example/video" });
check("endereço de transmissão de outro sítio é recusado", r.html.includes("YouTube ou do Facebook"));
await alice.submit(eventPath, 'name="streamUrl"', { streamUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ" });
r = await alice.get(`/events/${slug}`);
check("transmissão guardada mas fora do ar não aparece ao público", !r.html.includes("youtube.com/embed"));
await alice.submit(eventPath, "Pôr em direto");
r = await alice.get(`/events/${slug}`);
check(
  "em direto, o leitor aparece na página do evento",
  r.html.includes("https://www.youtube.com/embed/dQw4w9WgXcQ") && /Transmissão em direto/.test(strip(r.html)),
  strip(r.html).slice(0, 300),
);
r = await alice.get("/events");
check("lista de eventos assinala o direto", /Em direto/.test(strip(r.html)));
r = await alice.get("/live");
check(
  "página de Transmissão mostra o cartão da transmissão",
  r.html.includes(`href="/live/${matId}"`) && strip(r.html).includes(`Open Teste ${stamp}`) && r.html.includes("i.ytimg.com"),
  strip(r.html).slice(0, 300),
);
r = await alice.get(`/live/${matId}`);
check("página da transmissão embute o vídeo", r.html.includes("https://www.youtube.com/embed/dQw4w9WgXcQ") && /Ao vivo/i.test(strip(r.html)));

// Placar
await alice.submit(eventPath, 'name="belt"', { gender: "MALE", ageGroup: "Adulto", belt: "Marrom", weightClass: "Leve", maxWeightKg: "76", price: "0" });
r = await alice.get(eventPath);
const scoreboardDivision = divisionLink(r.html, "Marrom Leve");
for (const [firstName, lastName] of [["Zola", "Paulo"], ["Wilson", "Manuel"]]) {
  await alice.submit(scoreboardDivision, 'name="firstName"', { firstName, lastName, birthDate: "1997-01-05", academyName: "" });
}
await alice.submit(scoreboardDivision, 'name="type"', { type: "SINGLE_ELIMINATION" });
r = await alice.get(scoreboardDivision);
const controlPath = r.html.match(/\/manage\/matches\/\w+\/scoreboard/)?.[0];
check("luta pronta tem ligação para o placar", Boolean(controlPath));

const matState = async () => (await fetch(`${BASE}/api/mats/${matId}/scoreboard`)).json();
let board = await matState();
check("área sem luta devolve placar vazio", board.scoreboard === null && board.matName === "Área 1", JSON.stringify(board).slice(0, 200));
r = await bob.get(controlPath);
check("outro utilizador não abre o controlo do placar", !r.html.includes('name="matId"'));

await alice.submit(controlPath, 'name="matId"', { matId, durationSeconds: "180" });
board = (await matState()).scoreboard;
check(
  "abrir o placar põe a luta na área, com a duração escolhida e a zeros",
  board?.clock.durationSeconds === 180 && board.clock.remainingMs === 180000 && board.clock.startedAt === null && board.red.points === 0,
  JSON.stringify(board).slice(0, 300),
);

const SCORE_FORM = 'value="points:2"';
await alice.submit(controlPath, SCORE_FORM, { change: "points:2" });
await alice.submit(controlPath, SCORE_FORM, { change: "points:3" });
await alice.submit(controlPath, SCORE_FORM, { change: "points:-1" });
await alice.submit(controlPath, SCORE_FORM, { change: "advantages:1" }, 1);
await alice.submit(controlPath, SCORE_FORM, { change: "penalties:-1" }, 1);
board = (await matState()).scoreboard;
check(
  "pontos, vantagens e punições chegam ao placar, sem descer de zero",
  board.red.points === 4 && board.blue.points === 0 && board.blue.advantages === 1 && board.blue.penalties === 0,
  JSON.stringify([board.red, board.blue]),
);
r = await alice.submit(controlPath, SCORE_FORM, { change: "points:99" });
check("variação de pontos absurda é recusada", r.html.includes("Valor inv"));

await alice.submit(controlPath, 'name="clock"', { clock: "start" });
board = (await matState()).scoreboard;
check("iniciar põe o cronómetro a correr", typeof board.clock.startedAt === "number");
await new Promise((resolve) => setTimeout(resolve, 1500));
await alice.submit(controlPath, 'name="clock"', { clock: "pause" });
board = (await matState()).scoreboard;
check(
  "pausar guarda o tempo que passou",
  board.clock.startedAt === null && board.clock.remainingMs < 179000 && board.clock.remainingMs > 170000,
  JSON.stringify(board.clock),
);

r = await carol.get(publicPath(scoreboardDivision));
check("chave pública mostra a luta a decorrer e os pontos", /A decorrer · Área 1/.test(strip(r.html)) && /4\s?–\s?0/.test(strip(r.html)), strip(r.html).slice(0, 400));

r = await alice.submit(controlPath, 'name="winner"', { winner: "", method: "Pontos" });
check("terminar sem vencedor é recusado", r.html.includes("Escolha o vencedor"));
r = await alice.submit(controlPath, 'name="winner"', { winner: "red", method: "Finalização" });
check("terminar a luta volta à categoria", r.status === 303 && new URL(r.location, BASE).pathname === scoreboardDivision, `${r.status} ${r.location}`);
board = await matState();
check("área fica livre depois da luta", board.scoreboard === null);
r = await alice.get(scoreboardDivision);
check(
  "resultado do placar fica na chave e fecha o pódio",
  /Finalização/.test(strip(r.html)) && /4\s?–\s?0/.test(strip(r.html)) && /1 ?º —/.test(strip(r.html)),
  strip(r.html).slice(0, 500),
);

await alice.submit(eventPath, "Terminar direto");
r = await alice.get(`/events/${slug}`);
check("terminar o direto tira o leitor da página do evento", !r.html.includes("youtube.com/embed"));
r = await alice.get(`/live/${matId}`);
check("transmissão terminada já não mostra o vídeo", !r.html.includes("youtube.com/embed") && /terminou/.test(strip(r.html)));
r = await alice.get("/live");
check("transmissão terminada sai da página de Transmissão", !r.html.includes(`href="/live/${matId}"`));

// Sair e entrar
await alice.submit("/manage", "Sair");
check("sair apaga o cookie", !alice.cookies.has("camps_session"));
r = await alice.submit("/login", "password", { email: `alice${stamp}@teste.local`, password: "senha-errada" });
check("senha errada é recusada", r.html.includes("palavra-passe incorretos") && !alice.cookies.has("camps_session"));
r = await alice.submit("/login", "password", { email: `ALICE${stamp}@teste.local`, password: "senha-da-alice" });
check("login entra no painel", r.status === 303 && alice.cookies.has("camps_session"), `${r.status}`);
r = await alice.submit("/login", "password", { email: "organizador@camps.local", password: "camps-demo" });
check("conta demo do seed faz login", r.status === 303, `${r.status}`);

const eve = new Browser();
for (let i = 0; i < 10; i++) await eve.submit("/login", "password", { email: `dave${stamp}@teste.local`, password: `errada-${i}` });
r = await eve.submit("/login", "password", { email: `dave${stamp}@teste.local`, password: "senha-do-dave" });
check("login bloqueia depois de 10 tentativas falhadas", r.html.includes("Demasiadas tentativas") && !eve.cookies.has("camps_session"));

console.log(failures ? `\n${failures} falha(s)` : "\ntudo certo");
process.exit(failures ? 1 : 0);
