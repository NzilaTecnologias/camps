"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { runAction, text, type ActionState } from "@/lib/action-state";
import { requireUser } from "@/server/auth";
import {
  addAthlete,
  createDivision,
  createEvent,
  createOrganizer,
  generateBracket,
  reportMatchResult,
  setEventStatus,
} from "@/server/manage";

export async function createOrganizerAction(_state: ActionState, formData: FormData) {
  return runAction(async () => {
    const user = await requireUser();
    await createOrganizer(user.id, text(formData, "name"));
    refresh();
  });
}

export async function createEventAction(_state: ActionState, formData: FormData) {
  return runAction(async () => {
    const user = await requireUser();
    const event = await createEvent(user.id, {
      organizerId: text(formData, "organizerId"),
      name: text(formData, "name"),
      date: text(formData, "date"),
      registrationClosesOn: text(formData, "registrationClosesOn"),
      venue: text(formData, "venue"),
      city: text(formData, "city"),
      description: text(formData, "description"),
    });
    redirect(`/manage/events/${event.id}`);
  });
}

export async function setEventStatusAction(eventId: string, status: "DRAFT" | "PUBLISHED") {
  return runAction(async () => {
    const user = await requireUser();
    await setEventStatus(user.id, eventId, status);
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
    refresh();
  });
}

export async function addAthleteAction(divisionId: string, _state: ActionState, formData: FormData) {
  return runAction(async () => {
    const user = await requireUser();
    await addAthlete(user.id, divisionId, {
      firstName: text(formData, "firstName"),
      lastName: text(formData, "lastName"),
      birthDate: text(formData, "birthDate"),
      academyName: text(formData, "academyName"),
    });
    refresh();
  });
}

export async function generateBracketAction(divisionId: string, _state: ActionState, formData: FormData) {
  return runAction(async () => {
    const user = await requireUser();
    await generateBracket(user.id, divisionId, text(formData, "type"));
    refresh();
  });
}

export async function reportResultAction(matchId: string, _state: ActionState, formData: FormData) {
  return runAction(async () => {
    const user = await requireUser();
    await reportMatchResult(user.id, matchId, text(formData, "winnerId"));
    refresh();
  });
}
