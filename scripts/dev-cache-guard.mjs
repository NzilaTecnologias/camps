// Corre antes de `npm run dev` (predev): começa cada sessão de desenvolvimento com a cache do
// Next.js (.next/dev) limpa. Reaproveitada depois de o servidor morrer a meio (falta de memória,
// janela fechada à força) ou de uma atualização, essa cache servia ao navegador código que já não
// batia com o do servidor, e a página ficava a recarregar sem parar ("HMR hash mismatch").
// Durante a sessão a cache funciona como sempre (as fontes do Google dependem dela); só não passa
// de uma sessão para a outra. O custo é a primeira página de cada arranque compilar de novo.
// Só afeta o desenvolvimento: em produção não há esta cache nem recargas automáticas.
import { existsSync, readFileSync, rmSync } from "node:fs";

const DEV_CACHE = ".next/dev";

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

if (existsSync(DEV_CACHE)) {
  rmSync(DEV_CACHE, { recursive: true, force: true });
  console.log("Cache de desenvolvimento da sessão anterior apagada (.next/dev); a primeira página demora um pouco mais.");
}
