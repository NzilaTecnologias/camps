"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { runAction, text, type ActionState } from "@/lib/action-state";
import { safeNext } from "@/lib/safe-next";
import { requireUser } from "@/server/auth";
import { publicDataChanged } from "@/server/cache-tags";
import {
  adjustScore,
  controlClock,
  createMat,
  finishMatch,
  openScoreboard,
  setMatLive,
  setMatStream,
} from "@/server/scoreboard";

export async function openScoreboardAction(matchId: string, _state: ActionState, formData: FormData) {
  return runAction(async () => {
    const user = await requireUser();
    const eventId = await openScoreboard(user.id, matchId, text(formData, "matId"), Number(text(formData, "durationSeconds")));
    publicDataChanged({ eventId, live: true });
    refresh();
  });
}

/** O botão carregado diz o que mudar, no formato "pontos:+2": marcador e variação. */
export async function scoreAction(matchId: string, corner: string, _state: ActionState, formData: FormData) {
  return runAction(async () => {
    const user = await requireUser();
    const [field, delta] = text(formData, "change").split(":");
    publicDataChanged({ eventId: await adjustScore(user.id, matchId, corner, field, Number(delta)), live: true });
    refresh();
  });
}

export async function clockAction(matchId: string, _state: ActionState, formData: FormData) {
  return runAction(async () => {
    const user = await requireUser();
    publicDataChanged({ eventId: await controlClock(user.id, matchId, text(formData, "clock")) });
    refresh();
  });
}

export async function finishMatchAction(
  matchId: string,
  backTo: string,
  _state: ActionState,
  formData: FormData,
) {
  return runAction(async () => {
    const user = await requireUser();
    const eventId = await finishMatch(user.id, matchId, text(formData, "winner"), text(formData, "method"));
    publicDataChanged({ eventId, community: true, live: true });
    // backTo chega do navegador como argumento da action: só pode apontar para dentro do site.
    redirect(safeNext(backTo, "/manage"));
  });
}

export async function createMatAction(eventId: string, _state: ActionState, formData: FormData) {
  return runAction(async () => {
    const user = await requireUser();
    await createMat(user.id, eventId, text(formData, "name"));
    refresh();
  });
}

export async function setMatStreamAction(matId: string, _state: ActionState, formData: FormData) {
  return runAction(async () => {
    const user = await requireUser();
    publicDataChanged({ eventId: await setMatStream(user.id, matId, text(formData, "streamUrl")), live: true });
    refresh();
  });
}

export async function setMatLiveAction(matId: string, isLive: boolean) {
  return runAction(async () => {
    const user = await requireUser();
    // A lista de eventos assinala os que estão em direto.
    publicDataChanged({ eventId: await setMatLive(user.id, matId, isLive), live: true, events: true });
    refresh();
  });
}
