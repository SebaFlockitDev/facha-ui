// facha-ui lab scaffold · live mode endpoint · removed by /facha-ui:apply when no runs remain
import { handleGet, handlePost } from "./live-core";

/** Development-only endpoint for the lab's live panel (see live-core.ts). 404 in production. */
export const dynamic = "force-dynamic";

const options = () => ({ root: process.cwd(), production: process.env.NODE_ENV === "production" });

export function GET(req: Request) {
  return handleGet(req, options());
}

export function POST(req: Request) {
  return handlePost(req, options());
}
