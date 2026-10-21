// O que cada papel da equipa pode ver e fazer na área de administração. As páginas e as ações
// do servidor perguntam sempre aqui; o menu lateral também, para só mostrar o que se pode abrir.

export type StaffRole = "ADMIN" | "FINANCE" | "SUPPORT";

export const ROLE_LABEL: Record<StaffRole, string> = {
  ADMIN: "Administrador",
  FINANCE: "Financeiro",
  SUPPORT: "Suporte",
};

export const ROLE_DESCRIPTION: Record<StaffRole, string> = {
  ADMIN: "Tudo, incluindo a equipa, o registo de atividade e o sistema",
  FINANCE: "Pagamentos, repasses, faturas e planos das federações",
  SUPPORT: "Utilizadores, organizações, eventos e e-mails",
};

const ALL: StaffRole[] = ["ADMIN", "FINANCE", "SUPPORT"];

const ACCESS = {
  /** Painel inicial e listas só de leitura. */
  dashboard: ALL,
  organizers: ALL,
  events: ALL,
  payments: ALL,
  /** Ver e suspender contas, terminar sessões, confirmar e-mails. */
  users: ["ADMIN", "SUPPORT"],
  /** Despublicar e cancelar eventos. */
  "events.moderate": ["ADMIN", "SUPPORT"],
  emails: ["ADMIN", "SUPPORT"],
  /** Repasses, faturas e planos das federações. */
  finance: ["ADMIN", "FINANCE"],
  staff: ["ADMIN"],
  audit: ["ADMIN"],
  system: ["ADMIN"],
} satisfies Record<string, StaffRole[]>;

export type Permission = keyof typeof ACCESS;

export function can(role: StaffRole, permission: Permission): boolean {
  return (ACCESS[permission] as StaffRole[]).includes(role);
}
