import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { Badge, Card, Empty } from "@/components/ui";
import { formatDate } from "@/lib/format";
import { getPublicFederation, listFederationAcademies } from "@/server/federations";

async function Academies({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const federation = await getPublicFederation(slug);
  if (!federation) notFound();
  const academies = await listFederationAcademies(federation.id, federation.slug);
  await connection();
  const now = new Date();
  return academies.length === 0 ? (
    <Empty>Ainda não há academias filiadas.</Empty>
  ) : (
    <Card className="divide-y divide-line">
      {academies.map(({ academy, validUntil }) => (
        <div key={academy.id} className="flex flex-wrap items-center gap-3 px-5 py-4">
          <Link href={`/academies/${academy.id}`} className="min-w-0 flex-1 font-semibold hover:text-primary">
            {academy.name}
          </Link>
          <span className="text-sm text-muted">até {formatDate(validUntil)}</span>
          {validUntil >= now ? <Badge tone="success">Filiação em dia</Badge> : <Badge tone="warning">Expirada</Badge>}
        </div>
      ))}
    </Card>
  );
}

export default function FederationAcademiesPublicPage({ params }: PageProps<"/f/[slug]/academies">) {
  return (
    <Suspense fallback={<p className="text-sm text-muted">A carregar…</p>}>
      <Academies params={params} />
    </Suspense>
  );
}
