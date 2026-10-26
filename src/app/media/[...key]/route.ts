import { imageTypeOfKey } from "@/lib/image-file";
import { isValidKey, storage } from "@/server/storage";

// Ficheiros carregados (imagens dos eventos). Cada carregamento tem uma chave nova, por isso o
// navegador e um CDN podem guardá-los para sempre.
export async function GET(_request: Request, { params }: RouteContext<"/media/[...key]">) {
  const key = (await params).key.join("/");
  const type = isValidKey(key) ? imageTypeOfKey(key) : null;
  const bytes = type ? await storage().read(key) : null;
  if (!type || !bytes) return new Response("Não encontrado", { status: 404 });
  return new Response(new Uint8Array(bytes), {
    headers: {
      "Content-Type": type,
      "Content-Length": String(bytes.length),
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
