// Corre antes de `npm run dev` (predev). Apaga a cache de desenvolvimento do Next.js (.next/dev)
// quando as dependências mudaram desde a última vez (package-lock.json diferente): depois de
// atualizar o Next.js ou acrescentar pacotes, uma cache antiga pode servir ao navegador código que
// já não bate com o do servidor, e a página fica a recarregar sem parar ("HMR hash mismatch").
// Só afeta o desenvolvimento: em produção não há esta cache nem recargas automáticas.
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";

const DEV_CACHE = ".next/dev";
// Fora de .next/dev, para sobreviver quando a cache é apagada.
const STAMP = ".next/dev-deps.sha256";

const hash = createHash("sha256").update(readFileSync("package-lock.json")).digest("hex");

function running(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error.code === "EPERM";
  }
}

// Com um servidor de desenvolvimento a correr, não se mexe na cache que ele está a usar
// (o próprio `next dev` avisa a seguir que já há um servidor).
let lock = null;
try {
  lock = JSON.parse(readFileSync(`${DEV_CACHE}/lock`, "utf8"));
} catch {}
if (lock?.pid && running(lock.pid)) process.exit(0);

const previous = existsSync(STAMP) ? readFileSync(STAMP, "utf8").trim() : null;
if (previous !== hash && existsSync(DEV_CACHE)) {
  rmSync(DEV_CACHE, { recursive: true, force: true });
  console.log("As dependências mudaram: a cache de desenvolvimento (.next/dev) foi apagada e vai ser refeita.");
}
mkdirSync(".next", { recursive: true });
writeFileSync(STAMP, hash);
