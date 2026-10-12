import { Icon } from "./ui";

// Ilustrações da página inicial: pedaços da interface desenhados com dados de exemplo.
// São decorativas, por isso ficam escondidas dos leitores de ecrã.

type Fighter = { name: string; academy: string; won?: boolean };

function MockMatch({ red, blue }: { red: Fighter | null; blue: Fighter | null }) {
  const row = (fighter: Fighter | null, stripe: string) => (
    <div className={`flex items-stretch ${fighter?.won ? "bg-success/10" : ""}`}>
      <span className={`w-1 shrink-0 ${stripe}`} />
      <div className="flex min-w-0 flex-1 items-center gap-2 px-2.5 py-1.5">
        <span className="min-w-0 flex-1">
          <span className={`block truncate text-xs ${fighter?.won ? "font-bold" : fighter ? "" : "text-muted"}`}>
            {fighter?.name ?? "A definir"}
          </span>
          {fighter && <span className="block truncate text-[10px] text-muted">{fighter.academy}</span>}
        </span>
        {fighter?.won && (
          <span className="flex h-4 w-4 items-center justify-center rounded-full bg-success text-ink">
            <Icon name="check" className="h-3 w-3" />
          </span>
        )}
      </div>
    </div>
  );
  return (
    <div className="w-40 overflow-hidden rounded-md border border-line bg-surface shadow-lg shadow-black/40">
      {row(red, "bg-corner-red")}
      <div className="border-t border-line" />
      {row(blue, "bg-corner-blue")}
    </div>
  );
}

const QUARTERS: [Fighter, Fighter][] = [
  [
    { name: "Kiluanji C.", academy: "Kimura Luanda", won: true },
    { name: "Adilson N.", academy: "Benguela Fight Team" },
  ],
  [
    { name: "André K.", academy: "Checkmat Talatona", won: true },
    { name: "Hélder G.", academy: "Gracie Barra Angola" },
  ],
  [
    { name: "Edson D.", academy: "Kimura Luanda" },
    { name: "Gelson P.", academy: "Palanca BJJ", won: true },
  ],
  [
    { name: "Nelson T.", academy: "Checkmat Talatona", won: true },
    { name: "Mateus S.", academy: "Gracie Barra Angola" },
  ],
];

export function BracketMock() {
  const heading = "mb-3 font-display text-xs font-bold uppercase tracking-widest text-muted";
  return (
    <div aria-hidden="true" className="flex gap-5">
      <div>
        <p className={heading}>Quartas</p>
        <div className="flex flex-col gap-3">
          {QUARTERS.map(([red, blue]) => (
            <MockMatch key={red.name} red={red} blue={blue} />
          ))}
        </div>
      </div>
      <div className="flex flex-col">
        <p className={heading}>Semifinal</p>
        <div className="flex flex-1 flex-col justify-around gap-3">
          <MockMatch red={{ ...QUARTERS[0][0], won: true }} blue={{ ...QUARTERS[1][0], won: false }} />
          <MockMatch red={{ ...QUARTERS[2][1], won: false }} blue={{ ...QUARTERS[3][0], won: false }} />
        </div>
      </div>
      <div className="flex flex-col">
        <p className={heading}>Final</p>
        <div className="flex flex-1 flex-col justify-center">
          <MockMatch red={{ ...QUARTERS[0][0], won: false }} blue={null} />
        </div>
      </div>
    </div>
  );
}

/** Duas lutas das quartas, para o cartão das chaves. */
export function MiniBracketMock() {
  return (
    <div aria-hidden="true" className="flex flex-col items-center gap-2">
      <MockMatch red={QUARTERS[0][0]} blue={QUARTERS[0][1]} />
      <MockMatch red={QUARTERS[2][0]} blue={QUARTERS[2][1]} />
    </div>
  );
}

export function PaymentMock() {
  return (
    <div aria-hidden="true" className="mx-auto w-56 rounded-[1.75rem] border border-line bg-ink p-3 shadow-xl shadow-black/50">
      <div className="mx-auto mb-3 h-1.5 w-14 rounded-full bg-white/15" />
      <div className="rounded-2xl bg-surface p-4">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-muted">Pedido de pagamento</p>
        <p className="mt-2 font-display text-3xl font-bold leading-none">15 000,00 Kz</p>
        <p className="mt-1 text-xs text-muted">Copa de Luanda · Adulto Azul Leve</p>
        <div className="mt-4 flex gap-2">
          <span className="flex-1 rounded-lg border border-line py-2 text-center text-xs font-semibold text-muted">
            Recusar
          </span>
          <span className="flex-1 rounded-lg bg-primary py-2 text-center text-xs font-semibold text-white">
            Confirmar
          </span>
        </div>
      </div>
    </div>
  );
}

export function PodiumMock() {
  const steps = [
    { place: 2, name: "André K.", height: "h-14", medal: "bg-slate-300 text-slate-900" },
    { place: 1, name: "Kiluanji C.", height: "h-20", medal: "bg-accent text-ink" },
    { place: 3, name: "Gelson P.", height: "h-10", medal: "bg-amber-700 text-white" },
  ];
  return (
    <div aria-hidden="true" className="flex items-end justify-center gap-2">
      {steps.map((step) => (
        <div key={step.place} className="flex w-20 flex-col items-center gap-2">
          <span
            className={`flex h-8 w-8 items-center justify-center rounded-full font-display text-sm font-bold ${step.medal}`}
          >
            {step.place}º
          </span>
          <span className="truncate text-xs">{step.name}</span>
          <div className={`w-full rounded-t-md border border-b-0 border-line bg-surface-2 ${step.height}`} />
        </div>
      ))}
    </div>
  );
}

export function PanelMock() {
  const rows = [
    { name: "Adulto Masculino Azul Leve", meta: "8 inscritos", tag: "Chave gerada" },
    { name: "Adulto Masculino Azul Médio", meta: "5 inscritos", tag: "Chave gerada" },
    { name: "Adulto Feminino Roxa Pena", meta: "3 inscritas", tag: "Sem chave" },
  ];
  return (
    <div aria-hidden="true" className="space-y-2">
      {rows.map((row) => (
        <div key={row.name} className="flex items-center gap-3 rounded-lg border border-line bg-surface px-3 py-2">
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-semibold">{row.name}</p>
            <p className="text-[10px] text-muted">{row.meta}</p>
          </div>
          <span
            className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${row.tag === "Sem chave" ? "bg-foreground/10 text-muted" : "bg-primary/15 text-primary"}`}
          >
            {row.tag}
          </span>
        </div>
      ))}
    </div>
  );
}

/** O ecrã de TV do placar, em miniatura. */
export function ScoreboardMock() {
  const corner = (name: string, academy: string, points: number, advantages: number, color: string) => (
    <div className={`flex items-center gap-4 px-5 py-5 ${color}`}>
      <div className="min-w-0 flex-1">
        <p className="truncate font-display text-3xl font-bold uppercase leading-none text-white">{name}</p>
        <p className="mt-1 truncate text-xs text-white/75">{academy}</p>
      </div>
      <span className="text-xs font-semibold text-yellow-300">V {advantages}</span>
      <span className="font-display text-6xl font-bold leading-none text-white tabular-nums">{points}</span>
    </div>
  );
  return (
    <div aria-hidden="true" className="overflow-hidden rounded-2xl border border-line bg-black shadow-2xl shadow-black/60">
      {corner("Kiluanji Cassule", "Kimura Luanda", 4, 1, "bg-[#b91c1c]")}
      <div className="flex items-center justify-between gap-4 px-5 py-2">
        <span className="truncate text-xs text-white/60">Área 1 · Adulto Azul Leve</span>
        <span className="font-mono text-3xl font-bold text-white">2:47</span>
        <span className="flex items-center gap-1.5 text-xs font-semibold text-red-400">
          <span className="h-2 w-2 animate-pulse rounded-full bg-red-500" />
          Em direto
        </span>
      </div>
      {corner("André Kiala", "Checkmat Talatona", 2, 0, "bg-[#1d4ed8]")}
    </div>
  );
}
