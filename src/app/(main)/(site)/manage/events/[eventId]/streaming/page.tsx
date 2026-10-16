import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";
import { ActionForm } from "@/components/action-form";
import { Field } from "@/components/field";
import { Notice, SectionHeader } from "@/components/manage/parts";
import { Badge, Card, Empty, Icon, LinkButton } from "@/components/ui";
import { parseStreamUrl } from "@/lib/stream";
import { requireUser } from "@/server/auth";
import { getEventWorkspace, listStreams } from "@/server/organizer";
import { setMatLiveAction, setMatStreamAction } from "../../../scoreboard-actions";

const STEPS = [
  { title: "Crie o direto", text: "No YouTube Studio ou no Facebook, crie uma transmissão em direto e copie o endereço do vídeo." },
  { title: "Junte o placar", text: "No OBS, adicione a Sobreposição da área como fonte de navegador por cima da câmara." },
  { title: "Cole o endereço", text: "Guarde o endereço do vídeo na área respetiva, aqui em baixo." },
  { title: "Ponha no ar", text: "Carregue em Pôr em direto: o vídeo aparece na página do evento e em Transmissão." },
];

async function Streaming({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  const user = await requireUser();
  const [event, mats] = await Promise.all([getEventWorkspace(user.id, eventId), listStreams(user.id, eventId)]);
  if (!event) return null;

  return (
    <>
      <SectionHeader
        title="Transmissão"
        description="O vídeo é transmitido pelo YouTube ou pelo Facebook; a Camps mostra-o na página do evento, ao lado do placar ao vivo."
      />

      <ol className="mb-8 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {STEPS.map((step, index) => (
          <li key={step.title}>
            <Card className="h-full p-4">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary font-display text-sm font-bold text-primary-fg">
                {index + 1}
              </span>
              <p className="mt-3 font-semibold">{step.title}</p>
              <p className="mt-1 text-sm text-muted">{step.text}</p>
            </Card>
          </li>
        ))}
      </ol>

      {event.status !== "PUBLISHED" && (
        <div className="mb-6">
          <Notice>O evento ainda não está publicado: as transmissões só aparecem ao público depois de o publicar.</Notice>
        </div>
      )}

      {mats.length === 0 ? (
        <Empty>
          Crie primeiro as áreas de luta em{" "}
          <Link href={`/manage/events/${event.id}/scoreboard`} className="font-semibold text-primary hover:underline">
            Placar e áreas
          </Link>
          .
        </Empty>
      ) : (
        <div className="grid gap-5 md:grid-cols-2">
          {mats.map((mat) => {
            const embed = mat.streamUrl ? parseStreamUrl(mat.streamUrl) : null;
            return (
              <Card key={mat.id} className="flex flex-col overflow-hidden">
                <div className="relative aspect-video bg-ink">
                  {embed?.thumbnailUrl ? (
                    <Image src={embed.thumbnailUrl} alt="" fill sizes="(min-width: 768px) 30rem, 100vw" className="object-cover opacity-80" />
                  ) : (
                    <div className="flex h-full items-center justify-center text-white/40">
                      <Icon name="video" className="h-12 w-12" />
                    </div>
                  )}
                  <div className="absolute top-3 left-3 flex gap-2">
                    {mat.isLive ? <Badge tone="danger">● AO VIVO</Badge> : <Badge tone="inverse">Fora do ar</Badge>}
                    {embed && <Badge tone="inverse">{embed.provider}</Badge>}
                  </div>
                  <p className="absolute bottom-3 left-3 font-display text-2xl font-bold uppercase text-white drop-shadow">
                    {mat.name}
                  </p>
                </div>

                <div className="flex flex-1 flex-col gap-4 p-5">
                  <ActionForm
                    action={setMatStreamAction.bind(null, mat.id)}
                    submitLabel="Guardar endereço"
                    submitVariant="secondary"
                    className="flex flex-col gap-3"
                  >
                    <Field
                      label="Endereço do vídeo (YouTube ou Facebook)"
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
                    <Link href={`/overlay/${mat.id}`} target="_blank" className="inline-flex items-center gap-1 font-semibold hover:text-primary">
                      Sobreposição para o OBS <Icon name="external" className="h-3.5 w-3.5" />
                    </Link>
                    {mat.isLive && (
                      <Link href={`/live/${mat.id}`} target="_blank" className="inline-flex items-center gap-1 font-semibold hover:text-primary">
                        Ver como o público <Icon name="external" className="h-3.5 w-3.5" />
                      </Link>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <div className="mt-6">
        <LinkButton href={`/manage/events/${event.id}/scoreboard`} variant="secondary">
          <Icon name="monitor" />
          Ir para o placar
        </LinkButton>
      </div>
    </>
  );
}

export default function StreamingPage({ params }: PageProps<"/manage/events/[eventId]/streaming">) {
  return (
    <Suspense fallback={<p className="text-sm text-muted">A carregar…</p>}>
      <Streaming params={params} />
    </Suspense>
  );
}
