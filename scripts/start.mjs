// `npm start`: arranca a build de produção como no Docker. Com `output: "standalone"` o
// `next start` não serve; o servidor é o .next/standalone/server.js, que precisa ao lado dele das
// pastas public/ e .next/static (o Dockerfile copia-as da mesma maneira).
import { spawn } from "node:child_process";
import { cpSync, existsSync } from "node:fs";
import path from "node:path";

const standalone = path.resolve(".next/standalone");
if (!existsSync(path.join(standalone, "server.js"))) {
  console.error("Não há build de produção: corra primeiro npm run build.");
  process.exit(1);
}
cpSync("public", path.join(standalone, "public"), { recursive: true });
cpSync(".next/static", path.join(standalone, ".next/static"), { recursive: true });

const env = {
  ...process.env,
  NODE_ENV: "production",
  // O server.js muda de pasta para .next/standalone: sem um caminho absoluto, as imagens
  // carregadas iam parar dentro da build e perdiam-se na build seguinte.
  UPLOADS_DIR: path.resolve(process.env.UPLOADS_DIR || "uploads"),
};
// O .env do projeto, como no desenvolvimento; as variáveis já definidas no ambiente ganham.
const child = spawn(process.execPath, [`--env-file-if-exists=${path.resolve(".env")}`, path.join(standalone, "server.js")], {
  stdio: "inherit",
  env,
});
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => child.kill(signal));
child.on("exit", (code, signal) => process.exit(code ?? (signal ? 1 : 0)));
