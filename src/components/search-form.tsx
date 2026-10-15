import Link from "next/link";
import { buttonClass } from "./ui";

type Props = {
  /** Valor atual de `?q=`. */
  value: string;
  label: string;
  placeholder: string;
  /** Endereço da página sem pesquisa, para o "Limpar". */
  clearHref: string;
};

/** Pesquisa por GET: o endereço com `?q=` pode ser partilhado e funciona sem JavaScript. */
export function SearchForm({ value, label, placeholder, clearHref }: Props) {
  return (
    <form className="mb-6 flex max-w-md flex-wrap items-center gap-2" role="search">
      <label className="sr-only" htmlFor="q">
        {label}
      </label>
      <input
        id="q"
        name="q"
        type="search"
        defaultValue={value}
        placeholder={placeholder}
        className="h-10 min-w-0 flex-1 rounded-lg border border-line bg-surface px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
      />
      <button type="submit" className={buttonClass("primary")}>
        Procurar
      </button>
      {value && (
        <Link href={clearHref} className="px-1 text-sm font-semibold text-primary hover:underline">
          Limpar
        </Link>
      )}
    </form>
  );
}
