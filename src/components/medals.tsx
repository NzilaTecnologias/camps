import type { Medals } from "@/server/community";

const KINDS = [
  { key: "gold", label: "Ouro", className: "bg-accent text-ink" },
  { key: "silver", label: "Prata", className: "bg-slate-300 text-slate-900" },
  { key: "bronze", label: "Bronze", className: "bg-amber-700 text-white" },
] as const;

/** Medalhas em três círculos (ouro, prata, bronze) com a contagem. */
export function MedalCounts({ medals, size = "md" }: { medals: Medals; size?: "sm" | "md" }) {
  const circle = size === "sm" ? "h-6 min-w-6 text-xs" : "h-8 min-w-8 text-sm";
  return (
    <span className="flex items-center gap-1.5">
      {KINDS.map((kind) => (
        <span
          key={kind.key}
          title={`${medals[kind.key]} ${kind.label.toLowerCase()}`}
          className={`flex items-center justify-center rounded-full px-1.5 font-bold ${circle} ${kind.className} ${medals[kind.key] === 0 ? "opacity-30" : ""}`}
        >
          <span className="sr-only">{kind.label}: </span>
          {medals[kind.key]}
        </span>
      ))}
    </span>
  );
}
