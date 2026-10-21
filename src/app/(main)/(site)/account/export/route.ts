import { exportUserData } from "@/server/account";
import { getCurrentUser } from "@/server/auth";

// "Descarregar os meus dados" em A minha conta: um ficheiro JSON com tudo o que a Camps guarda.
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return new Response("Inicie sessão para descarregar os seus dados.", { status: 401 });
  const data = await exportUserData(user.id);
  const day = new Date().toISOString().slice(0, 10);
  return new Response(JSON.stringify(data, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="camps-os-meus-dados-${day}.json"`,
      "Cache-Control": "no-store",
    },
  });
}
