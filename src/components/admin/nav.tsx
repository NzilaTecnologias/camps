"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { can, type Permission, type StaffRole } from "@/lib/admin-permissions";
import { Icon, type IconName } from "../ui";

type Item = { href: string; label: string; icon: IconName; permission: Permission };

const SECTIONS: { title: string; items: Item[] }[] = [
  {
    title: "Geral",
    items: [{ href: "/admin", label: "Painel", icon: "home", permission: "dashboard" }],
  },
  {
    title: "Plataforma",
    items: [
      { href: "/admin/users", label: "Utilizadores", icon: "users", permission: "users" },
      { href: "/admin/organizers", label: "Organizações", icon: "layers", permission: "organizers" },
      { href: "/admin/events", label: "Eventos", icon: "calendar", permission: "events" },
      { href: "/admin/emails", label: "E-mails", icon: "alert", permission: "emails" },
    ],
  },
  {
    title: "Dinheiro",
    items: [
      { href: "/admin/payments", label: "Pagamentos", icon: "wallet", permission: "payments" },
      { href: "/admin/invoices", label: "Faturas", icon: "ticket", permission: "finance" },
      { href: "/admin/federations", label: "Federações", icon: "flag", permission: "finance" },
    ],
  },
  {
    title: "Controlo",
    items: [
      { href: "/admin/staff", label: "Equipa", icon: "users", permission: "staff" },
      { href: "/admin/audit", label: "Registo de atividade", icon: "search", permission: "audit" },
      { href: "/admin/system", label: "Sistema", icon: "settings", permission: "system" },
    ],
  },
];

/** Menu da administração: só as secções que o papel de quem está a ver pode abrir. */
export function AdminNav({ role }: { role: StaffRole }) {
  const pathname = usePathname();
  const active = (href: string) => (href === "/admin" ? pathname === "/admin" : pathname.startsWith(href));
  return (
    <nav aria-label="Administração" className="flex flex-col gap-5">
      {SECTIONS.map((section) => {
        const items = section.items.filter((item) => can(role, item.permission));
        if (items.length === 0) return null;
        return (
          <div key={section.title}>
            <p className="mb-1.5 px-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/40">{section.title}</p>
            <ul className="space-y-0.5">
              {items.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={active(item.href) ? "page" : undefined}
                    className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors ${
                      active(item.href) ? "bg-white text-black font-semibold" : "text-white/75 hover:bg-white/10 hover:text-white"
                    }`}
                  >
                    <Icon name={item.icon} />
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </nav>
  );
}
