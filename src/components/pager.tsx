import Link from "next/link";
import { Icon, buttonClass } from "./ui";

/**
 * Paginação simples (anterior / seguinte) que mantém os outros parâmetros do endereço.
 * `params` são os parâmetros atuais sem `page`.
 */
export function Pager({
  basePath,
  params,
  page,
  totalPages,
}: {
  basePath: string;
  params: Record<string, string>;
  page: number;
  totalPages: number;
}) {
  if (totalPages <= 1) return null;
  const hrefFor = (target: number) => {
    const query = new URLSearchParams(Object.entries(params).filter(([, value]) => value));
    if (target > 1) query.set("page", String(target));
    const text = query.toString();
    return text ? `${basePath}?${text}` : basePath;
  };
  return (
    <nav aria-label="Páginas" className="mt-8 flex items-center justify-center gap-3">
      {page > 1 ? (
        <Link href={hrefFor(page - 1)} className={buttonClass("secondary")} rel="prev">
          <Icon name="chevron-left" />
          Anterior
        </Link>
      ) : (
        <span className={`${buttonClass("secondary")} pointer-events-none opacity-40`}>
          <Icon name="chevron-left" />
          Anterior
        </span>
      )}
      <span className="text-sm text-muted">
        Página {page} de {totalPages}
      </span>
      {page < totalPages ? (
        <Link href={hrefFor(page + 1)} className={buttonClass("secondary")} rel="next">
          Seguinte
          <Icon name="chevron-right" />
        </Link>
      ) : (
        <span className={`${buttonClass("secondary")} pointer-events-none opacity-40`}>
          Seguinte
          <Icon name="chevron-right" />
        </span>
      )}
    </nav>
  );
}

/** Número da página pedido no endereço, entre 1 e 10 000. */
export function readPage(value: string | string[] | undefined): number {
  const page = Number(typeof value === "string" ? value : 1);
  return Number.isInteger(page) && page >= 1 && page <= 10_000 ? page : 1;
}
