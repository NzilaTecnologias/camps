import type { ReactNode } from "react";
import { PageTitle } from "../ui";

/** Cabeçalho de uma página da administração. */
export function AdminHeader({ title, description, aside }: { title: string; description?: string; aside?: ReactNode }) {
  return (
    <header className="mb-8 flex flex-wrap items-end justify-between gap-4 border-b border-line pb-6">
      <div className="max-w-3xl">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">Administração Camps</p>
        <div className="mt-2">
          <PageTitle>{title}</PageTitle>
        </div>
        {description && <p className="mt-2 text-sm text-muted">{description}</p>}
      </div>
      {aside}
    </header>
  );
}

/** Caixa de pesquisa por GET (funciona sem JavaScript), com campos escondidos para os outros filtros. */
export function SearchBox({
  action,
  q,
  placeholder,
  hidden = {},
}: {
  action: string;
  q: string;
  placeholder: string;
  hidden?: Record<string, string>;
}) {
  return (
    <form action={action} className="mb-5 flex max-w-xl gap-2">
      {Object.entries(hidden).map(([name, value]) => value && <input key={name} type="hidden" name={name} value={value} />)}
      <input
        type="search"
        name="q"
        defaultValue={q}
        placeholder={placeholder}
        className="h-10 w-full rounded-lg border border-line bg-surface px-3 text-sm outline-none focus:border-primary"
      />
      <button type="submit" className="h-10 rounded-full border border-line bg-surface px-4 text-sm font-semibold hover:border-foreground/40">
        Procurar
      </button>
    </form>
  );
}

export const pageOf = (value: string | string[] | undefined) => Math.max(1, Number(typeof value === "string" ? value : 1) || 1);
export const textOf = (value: string | string[] | undefined) => (typeof value === "string" ? value.trim().slice(0, 100) : "");
