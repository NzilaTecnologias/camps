"use client";

import { SectionNav, type NavSection } from "./event-nav";

/** Secções do painel de uma federação; as marcadas Premium explicam-se a si mesmas quando o plano não as inclui. */
const FEDERATION_SECTIONS: NavSection[] = [
  {
    title: "Federação",
    items: [
      { segment: "", label: "Visão geral", icon: "home" },
      { segment: "settings", label: "Página da federação", icon: "settings" },
      { segment: "news", label: "Notícias", icon: "flag" },
    ],
  },
  {
    title: "Filiados",
    items: [
      { segment: "organizers", label: "Organizações", icon: "users" },
      { segment: "academies", label: "Academias filiadas", icon: "layers" },
      { segment: "plans", label: "Planos de filiação", icon: "ticket" },
      { segment: "members", label: "Atletas filiados", icon: "users" },
    ],
  },
  {
    title: "Dinheiro",
    items: [
      { segment: "billing", label: "Plano e faturas", icon: "ticket" },
      { segment: "payouts", label: "Quotas e repasses", icon: "wallet" },
    ],
  },
];

export function FederationNav({ federationId }: { federationId: string }) {
  return <SectionNav base={`/manage/federations/${federationId}`} sections={FEDERATION_SECTIONS} label="Secções da federação" />;
}
