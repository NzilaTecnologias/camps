import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

// Armazenamento dos ficheiros que os utilizadores carregam (imagens dos eventos). Por agora numa
// pasta do servidor (UPLOADS_DIR; em produção um volume do Docker, ver deploy/docker-compose.yml).
// Para passar a um armazenamento externo (Cloudflare R2, S3), basta outra implementação de
// Storage: as páginas só conhecem as chaves e mediaUrl() (lib/image-file.ts).

export type Storage = {
  put(key: string, bytes: Uint8Array): Promise<void>;
  /** Nulo se a chave não existir. */
  read(key: string): Promise<Buffer | null>;
  remove(key: string): Promise<void>;
};

/** Chaves que a Camps gera: pastas e nomes só com letras minúsculas, números e hífens. */
const KEY = /^(?:[a-z0-9-]+\/)*[a-z0-9-]+\.(?:jpg|png|webp)$/;

export function isValidKey(key: string): boolean {
  return KEY.test(key);
}

function localStorage(root: string): Storage {
  const file = (key: string) => {
    if (!isValidKey(key)) throw new Error(`Chave de ficheiro inválida: ${key}`);
    return path.join(root, ...key.split("/"));
  };
  return {
    async put(key, bytes) {
      const target = file(key);
      await mkdir(path.dirname(target), { recursive: true });
      await writeFile(target, bytes);
    },
    async read(key) {
      try {
        return await readFile(file(key));
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
        throw error;
      }
    },
    async remove(key) {
      await rm(file(key), { force: true });
    },
  };
}

let instance: Storage | null = null;

export function storage(): Storage {
  // A pasta só tem ficheiros carregados em tempo de execução: o Turbopack não a deve incluir na build.
  instance ??= localStorage(path.resolve(/*turbopackIgnore: true*/ process.env.UPLOADS_DIR || "uploads"));
  return instance;
}
