"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { runAction, text, type ActionState } from "@/lib/action-state";
import { requireUser, requireVerifiedUser } from "@/server/auth";
import { publicDataChanged } from "@/server/cache-tags";
import {
  addAthlete,
  createDivision,
  createEvent,
  createOrganizer,
  generateBracket,
  reportMatchResult,
  setEventStatus,
} from "@/server/manage";
import { removeMember, setMemberRole } from "@/server/team";

export async function createOrganizerAction(_state: ActionState, formData: FormData) {
  return runAction(async () => {
    const user = await requireVerifiedUser();
    await createOrganizer(user.id, text(formData, "name"));
    refresh();
  });
}

export async function createEventAction(_state: ActionState, formData: FormData) {
  return runAction(async () => {
    const user = await requireVerifiedUser();
    const event = await createEvent(user.id, {
      organizerId: text(formData, "organizerId"),
      name: text(formData, "name"),
      sport: text(formData, "sport"),
      date: text(formData, "date"),
      registrationClosesOn: text(formData, "registrationClosesOn"),
      venue: text(formData, "venue"),
      city: text(formData, "city"),
      description: text(formData, "description"),
      latitude: text(formData, "latitude"),
      longitude: text(formData, "longitude"),
    });
    redirect(`/manage/events/${event.id}`);
  });
}

export async function setEventStatusAction(eventId: string, status: "DRAFT" | "PUBLISHED") {
  return runAction(async () => {
    const user = await requireUser();
    await setEventStatus(user.id, eventId, status);
    publicDataChanged({ eventId, events: true, community: true, live: true });
    refresh();
  });
}

export async function createDivisionAction(eventId: string, _state: ActionState, formData: FormData) {
  return runAction(async () => {
    const user = await requireUser();
    await createDivision(user.id, eventId, {
      gender: text(formData, "gender"),
      ageGroup: text(formData, "ageGroup"),
      belt: text(formData, "belt"),
      weightClass: text(formData, "weightClass"),
      maxWeightKg: text(formData, "maxWeightKg"),
      price: text(formData, "price"),
    });
    publicDataChanged({ eventId });
    refresh();
  });
}

export async function addAthleteAction(divisionId: string, _state: ActionState, formData: FormData) {
  return runAction(async () => {
    const user = await requireUser();
    const eventId = await addAthlete(user.id, divisionId, {
      firstName: text(formData, "firstName"),
      lastName: text(formData, "lastName"),
      birthDate: text(formData, "birthDate"),
      academyName: text(formData, "academyName"),
    });
    publicDataChanged({ eventId, community: true });
    refresh();
  });
}

export async function generateBracketAction(divisionId: string, _state: ActionState, formData: FormData) {
  return runAction(async () => {
    const user = await requireUser();
    publicDataChanged({ eventId: await generateBracket(user.id, divisionId, text(formData, "type")) });
    refresh();
  });
}

export async function setMemberRoleAction(organizerId: string, _state: ActionState, formData: FormData) {
  return runAction(async () => {
    const user = await requireUser();
    await setMemberRole(user.id, organizerId, text(formData, "email"), text(formData, "role"));
    refresh();
  });
}

export async function removeMemberAction(organizerId: string, memberId: string) {
  return runAction(async () => {
    const user = await requireUser();
    await removeMember(user.id, organizerId, memberId);
    // Quem sai da organização deixa de poder abrir a página da equipa.
    if (memberId === user.id) redirect("/manage");
    refresh();
  });
}

export async function reportResultAction(matchId: string, _state: ActionState, formData: FormData) {
  return runAction(async () => {
    const user = await requireUser();
    publicDataChanged({ eventId: await reportMatchResult(user.id, matchId, text(formData, "winnerId")), community: true });
    refresh();
  });
}
