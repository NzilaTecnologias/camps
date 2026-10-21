import { Suspense, type ReactNode } from "react";
import { AdminNav } from "@/components/admin/nav";
import { ROLE_LABEL } from "@/lib/admin-permissions";
import { pageStaff } from "@/server/admin/session";
import { adminLogOutAction } from "../actions";

function Brand() {
  return (
    <div className="flex items-center gap-2 px-3">
      <span className="flex h-7 w-7 items-center justify-center rounded-md bg-primary font-display text-lg font-bold leading-none text-white">C</span>
      <span className="flex flex-col">
        <span className="font-display text-xl font-bold uppercase leading-none tracking-wide text-white">Camps</span>
        <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-accent">Administração</span>
      </span>
    </div>
  );
}

/** Menu e conta de quem está na administração; sem sessão válida, manda para a entrada. */
async function Sidebar() {
  const staff = await pageStaff();
  const account = (
    <div className="rounded-xl border border-white/10 bg-white/5 p-3 text-sm">
        <p className="truncate font-semibold text-white">{staff.name}</p>
        <p className="truncate text-xs text-white/50">{staff.email}</p>
        <p className="mt-1 text-xs font-semibold text-accent">{ROLE_LABEL[staff.role]}</p>
        <form action={adminLogOutAction} className="mt-3">
          <button type="submit" className="w-full rounded-full border border-white/20 px-3 py-1.5 text-xs font-semibold text-white hover:bg-white/10">
            Sair da administração
          </button>
        </form>
      </div>
  );
  return (
    <>
      {/* Ecrã largo: menu fixo à esquerda. */}
      <div className="hidden h-full flex-col gap-6 lg:flex">
        <Brand />
        <AdminNav role={staff.role} />
        <div className="mt-auto">{account}</div>
      </div>
      {/* Telemóvel: o menu abre e fecha, para o conteúdo ficar logo à vista. */}
      <details className="group lg:hidden">
        <summary className="flex cursor-pointer list-none items-center justify-between [&::-webkit-details-marker]:hidden">
          <Brand />
          <span className="rounded-full border border-white/20 px-3 py-1.5 text-xs font-semibold text-white group-open:bg-white group-open:text-black">Menu</span>
        </summary>
        <div className="mt-5 flex flex-col gap-6">
          <AdminNav role={staff.role} />
          {account}
        </div>
      </details>
    </>
  );
}

export default function AdminPanelLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col lg:flex-row">
      <aside className="border-b border-white/10 bg-ink p-4 lg:sticky lg:top-0 lg:h-dvh lg:w-64 lg:shrink-0 lg:overflow-y-auto lg:border-r lg:border-b-0">
        <Suspense fallback={<Brand />}>
          <Sidebar />
        </Suspense>
      </aside>
      <main className="min-w-0 flex-1 px-4 py-8 lg:px-10">
        <div className="mx-auto max-w-6xl">{children}</div>
      </main>
    </div>
  );
}
