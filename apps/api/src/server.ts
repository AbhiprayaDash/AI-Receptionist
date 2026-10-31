import Fastify, { type FastifyError, type FastifyRequest } from "fastify";
import cors from "@fastify/cors";
import jwt from "@fastify/jwt";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { db } from "./db.js";
import { config } from "./config.js";
import { startConversation, handleMessage } from "./conversation.js";
import { cancelAppointment, rescheduleAppointment } from "./scheduling.js";
import { BrowserTelephonyProvider, LocalVoiceCapability, OllamaProvider } from "./providers.js";

const app = Fastify({ logger: true });
await app.register(cors, { origin: true });
await app.register(jwt, { secret: config.jwtSecret });

type Claims = { userId: string; tenantId: string; role: string };
async function auth(request: FastifyRequest) {
  await request.jwtVerify();
}

declare module "fastify" {
  interface FastifyInstance { authenticate: typeof auth }
}
app.decorate("authenticate", auth);

app.setErrorHandler((error: FastifyError, _request, reply) => {
  const status = error.name === "ZodError" ? 400 : /not found|unavailable|outside|active|cancelled/i.test(error.message) ? 409 : (error as { statusCode?: number }).statusCode ?? 500;
  if (status >= 500) app.log.error(error);
  reply.code(status).send({ error: error.message });
});

app.get("/health", async () => {
  await db.$queryRaw`SELECT 1`;
  return { status: "ok", database: "connected", timezone: "Asia/Kolkata" };
});

app.post("/auth/login", async (request, reply) => {
  const input = z.object({ email: z.string().email(), password: z.string().min(8) }).parse(request.body);
  const user = await db.user.findUnique({ where: { email: input.email.toLowerCase() }, include: { memberships: true } });
  const membership = user?.memberships[0];
  if (!user || !membership || !(await bcrypt.compare(input.password, user.passwordHash))) return reply.code(401).send({ error: "Invalid email or password" });
  return { token: app.jwt.sign({ userId: user.id, tenantId: membership.tenantId, role: membership.role }), user: { name: user.name, email: user.email, role: membership.role } };
});

app.post("/auth/register", async (request, reply) => {
  const input = z.object({ name: z.string().min(2), email: z.string().email(), password: z.string().min(8), businessName: z.string().min(2) }).parse(request.body);
  const created = await db.$transaction(async (tx) => {
    const user = await tx.user.create({ data: { name: input.name, email: input.email.toLowerCase(), passwordHash: await bcrypt.hash(input.password, 12) } });
    const tenant = await tx.tenant.create({ data: { name: input.businessName } });
    await tx.membership.create({ data: { userId: user.id, tenantId: tenant.id, role: "OWNER" } });
    const business = await tx.business.create({ data: { tenantId: tenant.id, name: input.businessName, address: "", phone: "", greetingEnglish: `Welcome to ${input.businessName}.`, greetingHindi: `${input.businessName} में आपका स्वागत है।`, greetingOdia: `${input.businessName} କୁ ସ୍ୱାଗତ।` } });
    return { user, tenant, business };
  });
  reply.code(201);
  return { token: app.jwt.sign({ userId: created.user.id, tenantId: created.tenant.id, role: "OWNER" }), businessId: created.business.id };
});

app.get("/demo", async () => {
  const business = await db.business.findFirst({ where: { tenant: { name: "ABC Clinic Demo" } }, include: { services: true, staff: true } });
  if (!business) throw new Error("Demo business not found");
  return { businessId: business.id, name: business.name, services: business.services, staff: business.staff, fictional: true };
});

app.post("/conversations", async (request) => {
  const input = z.object({ businessId: z.string().uuid(), language: z.enum(["EN", "HI", "OR"]) }).parse(request.body);
  const exists = await db.business.count({ where: { id: input.businessId } });
  if (!exists) throw new Error("Business not found");
  return startConversation(input.businessId, input.language);
});

app.post("/conversations/:id/messages", async (request) => {
  const params = z.object({ id: z.string().uuid() }).parse(request.params);
  const input = z.object({ content: z.string().min(1).max(1000) }).parse(request.body);
  return handleMessage(params.id, input.content);
});

app.get("/integrations/status", async () => {
  const ollama = await new OllamaProvider().status();
  const voice = new LocalVoiceCapability();
  return { ollama, speech: { EN: voice.capability("EN"), HI: voice.capability("HI"), OR: voice.capability("OR") }, telephony: new BrowserTelephonyProvider().capability(), messaging: { mode: "SIMULATED", delivered: false } };
});

app.get("/dashboard", { preHandler: [app.authenticate] }, async (request) => {
  const claims = request.user as Claims;
  const business = await db.business.findUniqueOrThrow({ where: { tenantId: claims.tenantId } });
  const now = new Date();
  const todayStart = new Date(new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(now) + "T00:00:00+05:30");
  const tomorrow = new Date(todayStart.getTime() + 86_400_000);
  const [total, today, upcoming, conversations, notifications] = await Promise.all([
    db.appointment.count({ where: { tenantId: claims.tenantId } }),
    db.appointment.count({ where: { tenantId: claims.tenantId, status: "CONFIRMED", startsAt: { gte: todayStart, lt: tomorrow } } }),
    db.appointment.count({ where: { tenantId: claims.tenantId, status: "CONFIRMED", startsAt: { gte: now } } }),
    db.conversationSession.count({ where: { businessId: business.id } }),
    db.notification.count({ where: { businessId: business.id, status: "SIMULATED" } }),
  ]);
  return { business, stats: { total, today, upcoming, conversations, simulatedNotifications: notifications, conversionPercent: conversations ? Math.round(total / conversations * 100) : 0 } };
});

app.get("/appointments", { preHandler: [app.authenticate] }, async (request) => {
  const claims = request.user as Claims;
  return db.appointment.findMany({ where: { tenantId: claims.tenantId }, include: { customer: true, service: true, staff: true, notifications: true }, orderBy: { startsAt: "asc" } });
});

app.post("/appointments/:id/cancel", { preHandler: [app.authenticate] }, async (request) => {
  const claims = request.user as Claims;
  const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
  await cancelAppointment(db, claims.tenantId, id);
  return { status: "CANCELLED" };
});

app.post("/appointments/:id/reschedule", { preHandler: [app.authenticate] }, async (request) => {
  const claims = request.user as Claims;
  const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
  const { startsAt } = z.object({ startsAt: z.string().datetime() }).parse(request.body);
  return rescheduleAppointment(db, claims.tenantId, id, new Date(startsAt));
});

app.get("/customers", { preHandler: [app.authenticate] }, async (request) => {
  const claims = request.user as Claims;
  const business = await db.business.findUniqueOrThrow({ where: { tenantId: claims.tenantId } });
  return db.customer.findMany({ where: { businessId: business.id }, include: { appointments: { include: { service: true } } }, orderBy: { name: "asc" } });
});

app.get("/notifications", { preHandler: [app.authenticate] }, async (request) => {
  const claims = request.user as Claims;
  const business = await db.business.findUniqueOrThrow({ where: { tenantId: claims.tenantId } });
  return db.notification.findMany({ where: { businessId: business.id }, include: { appointment: { include: { customer: true } } }, orderBy: { createdAt: "desc" } });
});

app.patch("/business", { preHandler: [app.authenticate] }, async (request) => {
  const claims = request.user as Claims;
  const input = z.object({ name: z.string().min(2).optional(), address: z.string().optional(), phone: z.string().optional(), bufferMinutes: z.number().int().min(0).max(120).optional() }).parse(request.body);
  return db.business.update({ where: { tenantId: claims.tenantId }, data: input });
});

if (process.env.NODE_ENV !== "test" && !process.env.VERCEL) {
  await app.listen({ host: "0.0.0.0", port: config.port });
}

export { app };
