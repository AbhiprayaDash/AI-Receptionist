import type { IncomingMessage, ServerResponse } from "node:http";
import { app } from "../apps/api/src/server.js";

export default async function handler(request: IncomingMessage, response: ServerResponse) {
  await app.ready();
  const url = new URL(request.url ?? "/", "http://localhost");
  const rewrittenPath = url.searchParams.get("path");
  if (rewrittenPath !== null) {
    url.searchParams.delete("path");
    const query = url.searchParams.toString();
    request.url = `/${rewrittenPath}${query ? `?${query}` : ""}`;
  } else {
    request.url = `${url.pathname.replace(/^\/api(?=\/|$)/, "") || "/"}${url.search}`;
  }
  app.server.emit("request", request, response);
}
