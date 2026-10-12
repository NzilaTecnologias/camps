import Link from "next/link";
import {
  createMatAction,
  setMatLiveAction,
  setMatStreamAction,
} from "@/app/(main)/(site)/manage/scoreboard-actions";
import { ActionForm } from "./action-form";
import { Field } from "./field";
import { Badge, Card, Empty, SectionTitle } from "./ui";

type Fighter = { athlete: { firstName: string; lastName: string } } | null;

type Mat = {
  id: string;
  name: string;
  streamUrl: string | null;
  isLive: boolean;
  currentMatch: { id: string; red: Fighter; blue: Fighter } | null;
};

const fullName = (fighter: Fighter) =>
  fighter ? `${fighter.athlete.firstName} ${fighter.athlete.lastName}` : "A definir";

function MatCard({ mat }: { mat: Mat }) {
  return (
    <Card className="flex flex-col gap-4 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="font-display text-2xl font-bold uppercase leading-none">{mat.name}</h3>
        {mat.isLive ? <Badge tone="danger">● Em direto</Badge> : <Badge>Fora do ar</Badge>}
      </div>

      <p className="text-sm text-muted">
        {mat.currentMatch ? (
          <>
            No placar:{" "}
            <Link
              href={`/manage/matches/${mat.currentMatch.id}/scoreboard`}
              className="font-semibold text-primary hover:underline"
            >
              {fullName(mat.currentMatch.red)} × {fullName(mat.currentMatch.blue)}
            </Link>
          </>
        ) : (
          "Nenhuma luta no placar."
        )}
      </p>

      <ActionForm
        action={setMatStreamAction.bind(null, mat.id)}
        submitLabel="Guardar endereço"
        submitVariant="secondary"
        className="flex flex-col gap-3"
      >
        <Field
          label="Transmissão (endereço do YouTube ou do Facebook)"
          name="streamUrl"
          type="url"
          inputMode="url"
          defaultValue={mat.streamUrl ?? ""}
          placeholder="https://www.youtube.com/watch?v=…"
        />
      </ActionForm>

      {mat.streamUrl && (
        <ActionForm
          action={setMatLiveAction.bind(null, mat.id, !mat.isLive)}
          submitLabel={mat.isLive ? "Terminar direto" : "Pôr em direto"}
          submitVariant={mat.isLive ? "secondary" : "primary"}
        >
          {null}
        </ActionForm>
      )}

      <div className="mt-auto flex flex-wrap gap-x-5 gap-y-1 border-t border-line pt-3 text-sm">
        <Link href={`/scoreboard/${mat.id}`} target="_blank" className="font-semibold hover:text-primary">
          Ecrã de TV ↗
        </Link>
        <Link href={`/overlay/${mat.id}`} target="_blank" className="font-semibold hover:text-primary">
          Sobreposição para a transmissão ↗
        </Link>
      </div>
    </Card>
  );
}

/** Áreas de luta de um evento: placar de cada uma e a respetiva transmissão. */
export function MatManager({ eventId, mats }: { eventId: string; mats: Mat[] }) {
  return (
    <section className="mb-10">
      <SectionTitle>Áreas de luta e transmissão</SectionTitle>
      <p className="-mt-2 mb-4 max-w-3xl text-sm text-muted">
        Cada área tem um placar próprio. O ecrã de TV mostra-o em grande junto ao tatami; a sobreposição tem fundo
        transparente para pôr por cima do vídeo no programa de transmissão. O vídeo em si é transmitido pelo YouTube
        ou pelo Facebook e aparece na página do evento quando a área está em direto.
      </p>

      {mats.length === 0 ? (
        <Empty>Ainda não há áreas de luta. Crie a primeira abaixo.</Empty>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {mats.map((mat) => (
            <MatCard key={mat.id} mat={mat} />
          ))}
        </div>
      )}

      <Card className="mt-4 max-w-md p-5">
        <ActionForm
          action={createMatAction.bind(null, eventId)}
          submitLabel="Adicionar área"
          submitVariant="secondary"
          className="flex flex-col gap-3"
        >
          <Field label="Nova área de luta" name="name" placeholder="Área 1" required />
        </ActionForm>
      </Card>
    </section>
  );
}
