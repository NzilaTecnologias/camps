// O que cada papel na equipa de uma organização pode ver e fazer no painel dos eventos dela.
// As consultas e ações do servidor filtram sempre por aqui (memberOf em server/manage.ts); o menu
// do evento também, para só mostrar o que se pode abrir.

export type OrganizerRole = "OWNER" | "ADMIN" | "STAFF";

export const ORGANIZER_ROLES: OrganizerRole[] = ["OWNER", "ADMIN", "STAFF"];

export const ORGANIZER_ROLE_LABEL: Record<OrganizerRole, string> = {
  OWNER: "Dono",
  ADMIN: "Gestor",
  STAFF: "Mesário",
};

export const ORGANIZER_ROLE_DESCRIPTION: Record<OrganizerRole, string> = {
  OWNER: "Tudo, incluindo a equipa e a conta de pagamentos",
  ADMIN: "Eventos, categorias, chaves, programação, inscrições e reembolsos",
  STAFF: "Dia da prova: pesagem, placar e transmissão; vê as inscrições",
};

const ALL: OrganizerRole[] = ["OWNER", "ADMIN", "STAFF"];
const MANAGERS: OrganizerRole[] = ["OWNER", "ADMIN"];

const ACCESS = {
  /** Visão geral, lista de inscrições e programa das lutas, só de leitura. */
  view: ALL,
  /** Pesagem, placar, áreas de luta e transmissão. */
  floor: ALL,
  /** Página do evento, categorias, inscrições manuais, chaves, programação, descontos e cancelamentos. */
  event: MANAGERS,
  /** Pagamentos, reembolsos e o extrato do evento. */
  money: MANAGERS,
  /** Conta de pagamentos (onde caem as inscrições) e dados de faturação da organização. */
  payout: ["OWNER"],
  team: ["OWNER"],
} satisfies Record<string, OrganizerRole[]>;

export type OrganizerPermission = keyof typeof ACCESS;

export function rolesWith(permission: OrganizerPermission): OrganizerRole[] {
  return ACCESS[permission];
}

export function canOrganizer(role: OrganizerRole | null | undefined, permission: OrganizerPermission): boolean {
  return role != null && (ACCESS[permission] as OrganizerRole[]).includes(role);
}
