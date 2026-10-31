import type { Prisma, PrismaClient } from "./generated/prisma/client.js";

type Db = PrismaClient | Prisma.TransactionClient;

const TIMEZONE_OFFSET = "+05:30";

export function localDateTime(date: string, time: string) {
  const parsed = new Date(`${date}T${time}:00${TIMEZONE_OFFSET}`);
  if (Number.isNaN(parsed.getTime())) throw new Error("Invalid date or time");
  return parsed;
}

export function indiaDate(date: Date) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}

export async function availableSlots(db: Db, input: { businessId: string; staffId: string; serviceId: string; date: string }) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date)) throw new Error("Date must use YYYY-MM-DD");
  const dayStart = localDateTime(input.date, "00:00");
  const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60_000);
  const weekday = Number(new Intl.DateTimeFormat("en-US", { weekday: "short", timeZone: "Asia/Kolkata" }).format(dayStart) === "Sun"
    ? 0
    : ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(new Intl.DateTimeFormat("en-US", { weekday: "short", timeZone: "Asia/Kolkata" }).format(dayStart)));
  const [business, hours, service, holiday, appointments] = await Promise.all([
    db.business.findUnique({ where: { id: input.businessId }, select: { bufferMinutes: true } }),
    db.workingHours.findUnique({ where: { businessId_weekday: { businessId: input.businessId, weekday } } }),
    db.service.findFirst({ where: { id: input.serviceId, businessId: input.businessId, active: true } }),
    db.holiday.findFirst({ where: { businessId: input.businessId, date: dayStart } }),
    db.appointment.findMany({ where: { businessId: input.businessId, staffId: input.staffId, status: "CONFIRMED", startsAt: { lt: dayEnd }, endsAt: { gt: dayStart } }, select: { startsAt: true, endsAt: true } }),
  ]);
  if (!business || !hours || !service || holiday) return [];
  const duration = service.durationMinutes * 60_000;
  const step = (service.durationMinutes + business.bufferMinutes) * 60_000;
  const opening = localDateTime(input.date, hours.startTime);
  const closing = localDateTime(input.date, hours.endTime);
  const slots: string[] = [];
  for (let cursor = opening.getTime(); cursor + duration <= closing.getTime(); cursor += step) {
    const end = cursor + duration;
    const overlaps = appointments.some((a) => a.startsAt.getTime() < end && a.endsAt.getTime() > cursor);
    if (!overlaps && cursor > Date.now()) slots.push(new Date(cursor).toISOString());
  }
  return slots;
}

export async function createAppointment(db: PrismaClient, input: {
  tenantId: string; businessId: string; customerId: string; staffId: string; serviceId: string; startsAt: Date;
}) {
  return db.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${input.staffId}))`;
    const service = await tx.service.findFirst({ where: { id: input.serviceId, businessId: input.businessId, active: true } });
    if (!service) throw new Error("Service unavailable");
    const endsAt = new Date(input.startsAt.getTime() + service.durationMinutes * 60_000);
    const conflict = await tx.appointment.findFirst({
      where: { staffId: input.staffId, status: "CONFIRMED", startsAt: { lt: endsAt }, endsAt: { gt: input.startsAt } },
    });
    if (conflict) throw new Error("This slot is no longer available");
    const date = indiaDate(input.startsAt);
    const slots = await availableSlots(tx, { businessId: input.businessId, staffId: input.staffId, serviceId: input.serviceId, date });
    if (!slots.includes(input.startsAt.toISOString())) throw new Error("The selected time is outside current availability");
    return tx.appointment.create({ data: { ...input, endsAt } });
  }, { isolationLevel: "Serializable" });
}

export async function cancelAppointment(db: PrismaClient, tenantId: string, appointmentId: string) {
  const result = await db.appointment.updateMany({ where: { id: appointmentId, tenantId, status: "CONFIRMED" }, data: { status: "CANCELLED" } });
  if (!result.count) throw new Error("Appointment not found or already cancelled");
}

export async function rescheduleAppointment(db: PrismaClient, tenantId: string, appointmentId: string, startsAt: Date) {
  return db.$transaction(async (tx) => {
    const current = await tx.appointment.findFirst({ where: { id: appointmentId, tenantId, status: "CONFIRMED" } });
    if (!current) throw new Error("Appointment not found");
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${current.staffId}))`;
    const service = await tx.service.findUniqueOrThrow({ where: { id: current.serviceId } });
    const endsAt = new Date(startsAt.getTime() + service.durationMinutes * 60_000);
    const conflict = await tx.appointment.findFirst({ where: { id: { not: current.id }, staffId: current.staffId, status: "CONFIRMED", startsAt: { lt: endsAt }, endsAt: { gt: startsAt } } });
    if (conflict) throw new Error("This slot is no longer available");
    const slots = await availableSlots(tx, { businessId: current.businessId, staffId: current.staffId, serviceId: current.serviceId, date: indiaDate(startsAt) });
    if (!slots.includes(startsAt.toISOString())) throw new Error("The selected time is outside current availability");
    return tx.appointment.update({ where: { id: current.id }, data: { startsAt, endsAt } });
  }, { isolationLevel: "Serializable" });
}
