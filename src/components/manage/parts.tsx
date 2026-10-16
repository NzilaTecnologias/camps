import Link from "next/link";
import type { ReactNode } from "react";
import { Card, Icon, type IconName } from "../ui";

/** Título de cada secção do painel do evento. */
export function SectionHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        <h2 className="font-display text-3xl font-bold uppercase leading-none tracking-tight">{title}</h2>
        {description && <p className="mt-2 max-w-2xl text-sm text-muted">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}

const TILE_TONE = {
  neutral: "bg-foreground/8 text-foreground",
  primary: "bg-primary/15 text-primary",
  success: "bg-success/15 text-success",
  warning: "bg-warning/15 text-warning",
  danger: "bg-danger/15 text-danger",
} as const;

/** Número grande com ícone; com `href` o cartão inteiro leva à secção. */
export function StatTile({
  label,
  value,
  hint,
  icon,
  tone = "neutral",
  href,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  icon: IconName;
  tone?: keyof typeof TILE_TONE;
  href?: string;
}) {
  const body = (
    <Card className={`flex h-full items-start gap-4 p-5 ${href ? "transition hover:-translate-y-0.5 hover:border-foreground/30" : ""}`}>
      <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${TILE_TONE[tone]}`}>
        <Icon name={icon} className="h-5 w-5" />
      </span>
      <div className="min-w-0">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted">{label}</p>
        <p className="mt-1 font-display text-3xl font-bold leading-none break-words">{value}</p>
        {hint && <p className="mt-1.5 text-xs text-muted">{hint}</p>}
      </div>
    </Card>
  );
  return href ? (
    <Link href={href} className="block h-full">
      {body}
    </Link>
  ) : (
    body
  );
}

/** Tabela dentro de um cartão, com deslize horizontal no telemóvel. */
export function DataTable({ head, children }: { head: string[]; children: ReactNode }) {
  return (
    <Card className="overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[40rem] text-left text-sm">
          <thead className="border-b border-line bg-surface-2 text-xs uppercase tracking-wider text-muted">
            <tr>
              {head.map((label, index) => (
                <th key={`${label}-${index}`} scope="col" className="px-4 py-3 font-semibold">
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-line">{children}</tbody>
        </table>
      </div>
    </Card>
  );
}

/** Filtros por separadores com contagem (ex.: estado das inscrições). */
export function FilterTabs({ tabs }: { tabs: { href: string; label: string; count?: number; active: boolean }[] }) {
  return (
    <div className="mb-4 flex flex-wrap gap-2">
      {tabs.map((tab) => (
        <Link
          key={tab.href}
          href={tab.href}
          aria-current={tab.active ? "page" : undefined}
          className={`inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors ${
            tab.active
              ? "border-primary bg-primary text-primary-fg"
              : "border-line text-muted hover:border-foreground/40 hover:text-foreground"
          }`}
        >
          {tab.label}
          {tab.count !== undefined && (
            <span className={`rounded-full px-1.5 text-xs ${tab.active ? "bg-white/20" : "bg-foreground/8"}`}>
              {tab.count}
            </span>
          )}
        </Link>
      ))}
    </div>
  );
}

/** Aviso destacado dentro de uma secção. */
export function Notice({ tone = "warning", children }: { tone?: "warning" | "danger" | "success"; children: ReactNode }) {
  const style = {
    warning: "border-warning/40 bg-warning/10",
    danger: "border-danger/40 bg-danger/10",
    success: "border-success/40 bg-success/10",
  }[tone];
  return (
    <div className={`flex items-start gap-3 rounded-xl border p-4 text-sm ${style}`}>
      <Icon name={tone === "success" ? "check" : "alert"} className="mt-0.5 h-4 w-4" />
      <div>{children}</div>
    </div>
  );
}
