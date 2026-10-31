import type { HTTPMethods } from "fastify";
import { app } from "../../../../api/src/server";

type RouteContext = { params: Promise<{ path?: string[] }> };

async function forward(request: Request, context: RouteContext) {
  await app.ready();
  const { path = [] } = await context.params;
  const incomingUrl = new URL(request.url);
  const payload = request.method === "GET" || request.method === "HEAD"
    ? undefined
    : Buffer.from(await request.arrayBuffer());

  const result = await app.inject({
    method: request.method as HTTPMethods,
    url: `/${path.join("/")}${incomingUrl.search}`,
    headers: Object.fromEntries(request.headers.entries()),
    payload,
  });

  const headers = new Headers();
  for (const [name, value] of Object.entries(result.headers)) {
    if (value === undefined) continue;
    if (Array.isArray(value)) value.forEach((item) => headers.append(name, String(item)));
    else headers.set(name, String(value));
  }

  return new Response(result.body, { status: result.statusCode, headers });
}

export const dynamic = "force-dynamic";
export const maxDuration = 30;
export { forward as GET, forward as POST, forward as PUT, forward as PATCH, forward as DELETE, forward as OPTIONS };
