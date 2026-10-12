import { EVENT_STATUS_LABEL, REGISTRATION_STATUS_LABEL } from "@/lib/format";
import { Badge } from "./ui";

const EVENT_TONE = { DRAFT: "warning", PUBLISHED: "success", CANCELLED: "danger" } as const;
const REGISTRATION_TONE = { INCOMPLETE: "warning", PAID: "success", CANCELLED: "neutral" } as const;

export function EventStatusBadge({ status }: { status: keyof typeof EVENT_STATUS_LABEL }) {
  return <Badge tone={EVENT_TONE[status]}>{EVENT_STATUS_LABEL[status]}</Badge>;
}

export function RegistrationStatusBadge({ status }: { status: keyof typeof REGISTRATION_STATUS_LABEL }) {
  return <Badge tone={REGISTRATION_TONE[status]}>{REGISTRATION_STATUS_LABEL[status]}</Badge>;
}
