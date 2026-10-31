import type { Language } from "./providers.js";
import { copy, confirmation } from "./i18n.js";
import { availableSlots, createAppointment } from "./scheduling.js";
import { db } from "./db.js";

type BookingState = {
  step?: "NAME" | "PHONE" | "SERVICE" | "DATE" | "TIME" | "COMPLETE";
  name?: string; phone?: string; serviceId?: string; staffId?: string; date?: string; slots?: string[];
};

const interpolate = (value: string, vars: Record<string, string>) => Object.entries(vars).reduce((out, [key, val]) => out.replace(`{${key}}`, val), value);

export async function startConversation(businessId: string, language: Language) {
  const session = await db.conversationSession.create({ data: { businessId, language, state: { step: "NAME" } } });
  const message = `${copy[language].welcome}\n\n${copy[language].askName}`;
  await db.conversationMessage.create({ data: { sessionId: session.id, role: "assistant", content: message } });
  return { sessionId: session.id, message, mode: "TEXT", speechValidated: false };
}

export async function handleMessage(sessionId: string, content: string) {
  const session = await db.conversationSession.findUnique({ where: { id: sessionId }, include: { business: { include: { services: { where: { active: true } }, staff: { where: { active: true } } } } } });
  if (!session || session.status !== "ACTIVE") throw new Error("Conversation is not active");
  const language = session.language as Language;
  const state = session.state as BookingState;
  await db.conversationMessage.create({ data: { sessionId, role: "user", content } });
  let reply = copy[language].unclear;

  if (state.step === "NAME" && content.trim().length >= 2) {
    state.name = content.trim(); state.step = "PHONE"; reply = copy[language].askPhone;
  } else if (state.step === "PHONE") {
    const phone = content.replace(/[^\d+]/g, "");
    if (/^\+?\d{10,15}$/.test(phone)) {
      state.phone = phone; state.step = "SERVICE";
      reply = `${copy[language].askService}\n${session.business.services.map((s, i) => `${i + 1}. ${s.name}`).join("\n")}`;
    }
  } else if (state.step === "SERVICE") {
    const selected = session.business.services.find((s, i) => content.trim() === String(i + 1) || content.toLowerCase().includes(s.name.toLowerCase()));
    if (selected) {
      state.serviceId = selected.id; state.staffId = session.business.staff[0]?.id; state.step = "DATE"; reply = copy[language].askDate;
    }
  } else if (state.step === "DATE" && state.serviceId && state.staffId) {
    const date = content.match(/\d{4}-\d{2}-\d{2}/)?.[0];
    if (date) {
      const slots = await availableSlots(db, { businessId: session.businessId, staffId: state.staffId, serviceId: state.serviceId, date });
      if (slots.length) {
        state.date = date; state.slots = slots; state.step = "TIME";
        const labels = slots.slice(0, 8).map((slot) => new Intl.DateTimeFormat(language === "HI" ? "hi-IN" : language === "OR" ? "or-IN" : "en-IN", { hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" }).format(new Date(slot)));
        reply = interpolate(copy[language].askTime, { slots: labels.join(", ") });
      } else reply = copy[language].noSlots;
    }
  } else if (state.step === "TIME" && state.slots && state.serviceId && state.staffId && state.name && state.phone) {
    const hhmm = content.match(/(?:[01]?\d|2[0-3]):[0-5]\d/)?.[0];
    const selected = state.slots.find((slot) => new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Kolkata" }).format(new Date(slot)) === hhmm);
    if (selected) {
      const customer = await db.customer.upsert({
        where: { businessId_phone: { businessId: session.businessId, phone: state.phone } },
        update: { name: state.name, language }, create: { businessId: session.businessId, phone: state.phone, name: state.name, language },
      });
      const appointment = await createAppointment(db, { tenantId: session.business.tenantId, businessId: session.businessId, customerId: customer.id, staffId: state.staffId, serviceId: state.serviceId, startsAt: new Date(selected) });
      const message = confirmation(language, customer.name, session.business.name, appointment.startsAt);
      const manualUrl = `https://wa.me/${customer.phone.replace(/\D/g, "")}?text=${encodeURIComponent(message)}`;
      await db.notification.create({ data: { businessId: session.businessId, appointmentId: appointment.id, message, manualUrl, status: "SIMULATED" } });
      state.step = "COMPLETE";
      reply = interpolate(copy[language].confirm, { date: new Intl.DateTimeFormat(language === "HI" ? "hi-IN" : language === "OR" ? "or-IN" : "en-IN", { dateStyle: "long", timeStyle: "short", timeZone: "Asia/Kolkata" }).format(appointment.startsAt) });
      await db.conversationSession.update({ where: { id: sessionId }, data: { customerId: customer.id, status: "COMPLETED", state } });
      await db.conversationMessage.create({ data: { sessionId, role: "assistant", content: reply } });
      return { message: reply, complete: true, appointmentId: appointment.id, notification: { message, manualUrl, status: "SIMULATED" } };
    }
  }
  await db.conversationSession.update({ where: { id: sessionId }, data: { state } });
  await db.conversationMessage.create({ data: { sessionId, role: "assistant", content: reply } });
  return { message: reply, complete: false };
}
