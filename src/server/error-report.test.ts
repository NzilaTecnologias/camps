import { createServer, type IncomingMessage } from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, describe, expect, it } from "vitest";

describe("reportError", () => {
  const received: { req: IncomingMessage; body: string }[] = [];
  const server = createServer((req, res) => {
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", () => {
      received.push({ req, body });
      res.end("{}");
    });
  });
  afterAll(() => server.close());

  it("envia um envelope ao Sentry com a chave do DSN", async () => {
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const { port } = server.address() as AddressInfo;
    process.env.SENTRY_DSN = `http://chave123@127.0.0.1:${port}/42`;
    const { reportError } = await import("./error-report");

    await reportError(Object.assign(new Error("rebentou"), { digest: "abc" }), {
      tags: { route: "/events/[slug]" },
      request: { method: "GET", url: "/events/copa" },
    });

    expect(received).toHaveLength(1);
    const { req, body } = received[0];
    expect(req.url).toBe("/api/42/envelope/");
    expect(req.headers["x-sentry-auth"]).toContain("sentry_key=chave123");
    const [header, item, event] = body.split("\n").map((line) => JSON.parse(line));
    expect(header.event_id).toMatch(/^[0-9a-f]{32}$/);
    expect(item).toEqual({ type: "event" });
    expect(event.exception.values[0]).toMatchObject({ type: "Error", value: "rebentou" });
    expect(event.tags).toEqual({ route: "/events/[slug]", digest: "abc" });
    expect(event.request).toEqual({ method: "GET", url: "/events/copa" });
  });
});
