// Regras do placar por modalidade. Cada luta guarda sempre três marcadores por canto (pontos,
// vantagens e punições, colunas de Match); aqui define-se o que cada um quer dizer em cada desporto,
// que botões a mesa tem, as durações e as formas de vitória. Os valores seguem os regulamentos das
// federações internacionais (IBJJF, IJF, WKF, World Taekwondo, WAKO, UWW, IBA, FIAS); a mesa pode
// sempre corrigir com o botão −1.

export type Step = { value: number; label: string };

export type Mark = {
  /** Nome por extenso (ecrã de controlo, TV). */
  label: string;
  /** Abreviatura para a sobreposição e o cartão (ex.: "V", "S"). */
  short: string;
  /** Botões de somar; há sempre também um botão −1. */
  steps: Step[];
  /** Valor máximo (ex.: senshu só pode ser 1). */
  max?: number;
};

export type SportRules = {
  /** Nome do regulamento, mostrado na página de controlo. */
  rulebook: string;
  points: Mark;
  advantages: Mark | null;
  penalties: Mark & {
    /** Pontos que cada punição dá ao adversário (Taekwondo: gam-jeom = +1 ao outro). */
    opponentPoints?: number;
    /** Ao chegar a este número de punições o atleta perde (o placar avisa a mesa). */
    losesAt?: number;
  };
  /** Durações possíveis da luta (ou de cada round), em segundos. */
  durations: number[];
  defaultDuration: number;
  /** Duração por round em vez de por luta (o cronómetro repõe-se a cada round). */
  rounds?: number;
  methods: string[];
};

const plus = (...values: number[]): Step[] => values.map((value) => ({ value, label: `+${value}` }));

const BJJ: SportRules = {
  rulebook: "IBJJF",
  points: { label: "Pontos", short: "Pts", steps: [
    { value: 2, label: "+2 Queda / raspagem / joelho na barriga" },
    { value: 3, label: "+3 Passagem de guarda" },
    { value: 4, label: "+4 Montada / costas" },
  ] },
  advantages: { label: "Vantagens", short: "V", steps: plus(1) },
  penalties: { label: "Punições", short: "P", steps: plus(1), losesAt: 4 },
  durations: [120, 180, 240, 300, 360, 420, 480, 600],
  defaultDuration: 300,
  methods: ["Pontos", "Finalização", "Vantagens", "Decisão dos árbitros", "Desclassificação", "Desistência"],
};

const RULES: Record<string, SportRules> = {
  "Jiu-Jitsu": BJJ,
  Grappling: { ...BJJ, rulebook: "Grappling (pontos ao estilo IBJJF)" },
  Judo: {
    rulebook: "IJF",
    points: { label: "Waza-ari", short: "W", steps: [{ value: 1, label: "+ Waza-ari" }] },
    advantages: null,
    // O terceiro shido é hansoku-make: perde a luta.
    penalties: { label: "Shido", short: "S", steps: [{ value: 1, label: "+ Shido" }], losesAt: 3, max: 3 },
    durations: [120, 180, 240],
    defaultDuration: 240,
    methods: ["Ippon", "Waza-ari", "Waza-ari awasete ippon", "Golden score", "Hansoku-make", "Fusen-gachi (falta de comparência)", "Kiken-gachi (desistência)"],
  },
  Karaté: {
    rulebook: "WKF (kumite)",
    points: { label: "Pontos", short: "Pts", steps: [
      { value: 1, label: "+1 Yuko" },
      { value: 2, label: "+2 Waza-ari" },
      { value: 3, label: "+3 Ippon" },
    ] },
    // Vantagem do primeiro ponto sem resposta: 0 ou 1.
    advantages: { label: "Senshu", short: "S", steps: [{ value: 1, label: "Senshu" }], max: 1 },
    // Chui 1, 2 e 3, Hansoku-chui, Hansoku.
    penalties: { label: "Penalizações", short: "C", steps: [{ value: 1, label: "+ Penalização" }], losesAt: 5, max: 5 },
    durations: [90, 120, 180],
    defaultDuration: 180,
    methods: ["Pontos", "Diferença de 8 pontos", "Senshu", "Hantei (decisão)", "Hansoku", "Kiken (desistência)", "Shikkaku"],
  },
  Taekwondo: {
    rulebook: "World Taekwondo (melhor de 3 rounds)",
    points: { label: "Pontos", short: "Pts", steps: [
      { value: 1, label: "+1 Soco" },
      { value: 2, label: "+2 Tronco" },
      { value: 3, label: "+3 Cabeça" },
      { value: 4, label: "+4 Tronco com rotação" },
      { value: 5, label: "+5 Cabeça com rotação" },
    ] },
    advantages: { label: "Rounds ganhos", short: "R", steps: [{ value: 1, label: "+ Round ganho" }], max: 2 },
    penalties: { label: "Gam-jeom", short: "GJ", steps: [{ value: 1, label: "+ Gam-jeom" }], opponentPoints: 1, losesAt: 5 },
    durations: [60, 90, 120],
    defaultDuration: 120,
    rounds: 3,
    methods: ["Rounds (2–0)", "Rounds (2–1)", "Diferença de 12 pontos (PTG)", "Paragem pelo árbitro (RSC)", "KO", "Desclassificação (gam-jeom)", "Desistência"],
  },
  Kickboxing: {
    rulebook: "WAKO (point fighting)",
    points: { label: "Pontos", short: "Pts", steps: [
      { value: 1, label: "+1 Soco / pontapé ao tronco" },
      { value: 2, label: "+2 Pontapé à cabeça" },
      { value: 3, label: "+3 Pontapé saltado à cabeça" },
    ] },
    advantages: null,
    penalties: { label: "Advertências", short: "A", steps: [{ value: 1, label: "+ Advertência" }], losesAt: 4 },
    durations: [60, 90, 120, 180],
    defaultDuration: 120,
    rounds: 3,
    methods: ["Pontos", "Diferença de 10 pontos", "Decisão dos juízes", "KO", "Paragem pelo árbitro (RSC)", "Desclassificação", "Desistência"],
  },
  Luta: {
    rulebook: "UWW (luta livre / greco-romana)",
    points: { label: "Pontos", short: "Pts", steps: plus(1, 2, 4, 5) },
    advantages: null,
    penalties: { label: "Advertências", short: "A", steps: [{ value: 1, label: "+ Advertência" }], losesAt: 3 },
    durations: [120, 180],
    defaultDuration: 180,
    rounds: 2,
    methods: ["Pontos", "Encostamento (tombé)", "Superioridade técnica", "Desistência", "Lesão", "Desclassificação"],
  },
  Sambo: {
    rulebook: "FIAS",
    points: { label: "Pontos", short: "Pts", steps: plus(1, 2, 4) },
    advantages: null,
    penalties: { label: "Advertências", short: "A", steps: [{ value: 1, label: "+ Advertência" }], losesAt: 3 },
    durations: [180, 240, 300],
    defaultDuration: 300,
    methods: ["Pontos", "Vitória total (projeção perfeita)", "Submissão", "Diferença de 8 pontos", "Decisão dos árbitros", "Desclassificação", "Desistência"],
  },
  Boxe: {
    rulebook: "IBA (decisão dos juízes por round)",
    // A pontuação 10–9 é dos juízes; a mesa regista quem ganhou cada round.
    points: { label: "Rounds ganhos", short: "R", steps: [{ value: 1, label: "+ Round ganho" }] },
    advantages: { label: "Quedas sofridas", short: "Q", steps: [{ value: 1, label: "+ Queda (contagem)" }] },
    penalties: { label: "Advertências", short: "A", steps: [{ value: 1, label: "+ Advertência" }], losesAt: 3 },
    durations: [60, 90, 120, 180],
    defaultDuration: 180,
    rounds: 3,
    methods: ["Decisão unânime", "Decisão dividida", "KO", "Paragem pelo árbitro (RSC)", "Abandono", "Desclassificação"],
  },
  MMA: {
    rulebook: "Regras unificadas de MMA",
    points: { label: "Rounds ganhos", short: "R", steps: [{ value: 1, label: "+ Round ganho" }] },
    advantages: null,
    penalties: { label: "Pontos deduzidos", short: "D", steps: [{ value: 1, label: "+ Dedução" }] },
    durations: [180, 300],
    defaultDuration: 300,
    rounds: 3,
    methods: ["KO", "TKO", "Finalização", "Decisão unânime", "Decisão dividida", "Decisão maioritária", "Desclassificação"],
  },
};

/** Regras de uma modalidade; as que não têm regras próprias usam as do jiu-jitsu. */
export function rulesFor(sport: string): SportRules {
  return RULES[sport] ?? BJJ;
}

export type ScoreChange = { field: "points" | "advantages" | "penalties"; delta: number };

/** Confere se a mesa pode fazer esta alteração nesta modalidade (um botão que existe, ou −1). */
export function validChange(rules: SportRules, change: ScoreChange): boolean {
  const mark = rules[change.field];
  if (!mark) return false;
  return change.delta === -1 || mark.steps.some((step) => step.value === change.delta);
}

type Score = { points: number; advantages: number; penalties: number };

/**
 * Aplica uma alteração ao canto `self` e, quando as regras o dizem (Taekwondo), ao adversário.
 * Nunca desce abaixo de zero nem passa do máximo do marcador.
 */
export function applyChange(rules: SportRules, self: Score, opponent: Score, change: ScoreChange): { self: Score; opponent: Score } {
  const mark = rules[change.field]!;
  const before = self[change.field];
  const after = Math.min(mark.max ?? Infinity, Math.max(0, before + change.delta));
  const next = { self: { ...self, [change.field]: after }, opponent: { ...opponent } };
  const bonus = change.field === "penalties" ? (rules.penalties.opponentPoints ?? 0) : 0;
  if (bonus && after !== before) {
    next.opponent.points = Math.max(0, opponent.points + bonus * (after - before));
  }
  return next;
}

/** Aviso para a mesa quando um atleta chegou ao limite de punições da modalidade. */
export function penaltyWarning(rules: SportRules, penalties: number): string | null {
  const limit = rules.penalties.losesAt;
  if (!limit || penalties < limit) return null;
  return `${penalties} ${rules.penalties.label.toLowerCase()}: pelas regras ${rules.rulebook}, perde a luta`;
}
