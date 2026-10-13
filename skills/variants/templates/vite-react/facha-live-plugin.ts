// facha-ui lab scaffold (Vite) · live mode endpoint · removed by /facha-ui:apply when no runs remain
import type { IncomingMessage, ServerResponse } from "node:http";
import type { Plugin } from "vite";
import { handleGet, handlePost } from "./facha-live/live-core";

/**
 * The live panel's endpoint for a Vite dev server, at <LAB_BASE>/facha-live: the same rules as the
 * Next.js route (live-core.ts: same origin, JSON only, the session token, nothing is applied).
 * `apply: "serve"` makes Vite load it only in `vite dev`; a build never includes it.
 *
 * Registered in vite.config with a form that never breaks the dev server when the lab folder is
 * missing (a teammate's clone, after /facha-ui:apply):
 *   plugins: [react(), ...(await import("./facha-lab/facha-live-plugin.ts").then((m) => [m.fachaLive()]).catch(() => []))]
 */

const LAB_BASE = "/facha-lab"; /*__LAB_BASE__*/
const MAX_BODY = 64 * 1024;

function readBody(req: IncomingMessage): Promise<Buffer | null> {
  return new Promise((resolve) => {
    const chunks: Buffer[] = [];
    let size = 0;
    req.on("data", (c: Buffer) => {
      size += c.length;
      if (size > MAX_BODY) {
        resolve(null);
        req.destroy();
      } else chunks.push(c);
    });
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", () => resolve(null));
  });
}

async function send(res: ServerResponse, response: Response) {
  res.statusCode = response.status;
  response.headers.forEach((value, key) => res.setHeader(key, value));
  res.end(Buffer.from(await response.arrayBuffer()));
}

export function fachaLive(): Plugin {
  return {
    name: "facha-ui-live",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use(`${LAB_BASE}/facha-live`, async (req, res) => {
        const local = server.resolvedUrls?.local?.[0]?.replace(/\/+$/, "");
        const options = { root: server.config.root, production: false, baseUrl: local };
        const url = `http://${req.headers.host ?? "localhost"}${(req as IncomingMessage & { originalUrl?: string }).originalUrl ?? req.url ?? "/"}`;
        const headers = new Headers();
        for (const [k, v] of Object.entries(req.headers)) if (typeof v === "string") headers.set(k, v);
        try {
          if (req.method === "GET") return await send(res, handleGet(new Request(url, { headers }), options));
          if (req.method === "POST") {
            const body = await readBody(req);
            if (body === null) return await send(res, new Response(JSON.stringify({ error: "Request too large" }), { status: 413 }));
            return await send(res, await handlePost(new Request(url, { method: "POST", headers, body }), options));
          }
          await send(res, new Response(null, { status: 405 }));
        } catch {
          await send(res, new Response(JSON.stringify({ error: "facha-ui live endpoint failed" }), { status: 500 }));
        }
      });
    },
  };
}
