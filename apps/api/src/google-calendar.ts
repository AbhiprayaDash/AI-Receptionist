import { createSign } from "node:crypto";
import { config } from "./config.js";
import { db } from "./db.js";

type CalendarAppointment = {
  id: string;
  startsAt: Date;
  endsAt: Date;
  externalCalendarEventId: string | null;
  business: { name: string; address: string; timezone: string };
  customer: { name: string; phone: string };
  service: { name: string };
  staff: { name: string };
};

const calendarApi = "https://www.googleapis.com/calendar/v3";
const tokenApi = "https://oauth2.googleapis.com/token";
const base64Url = (value: string) => Buffer.from(value).toString("base64url");

function configured() {
  return Boolean(config.googleCalendarId && config.googleServiceAccountEmail && config.googleServiceAccountPrivateKey);
}

async function accessToken() {
  if (!configured()) throw new Error("Google Calendar credentials are not configured");
  const now = Math.floor(Date.now() / 1000);
  const header = base64Url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claim = base64Url(JSON.stringify({
    iss: config.googleServiceAccountEmail,
    scope: "https://www.googleapis.com/auth/calendar",
    aud: tokenApi,
    iat: now,
    exp: now + 3600,
  }));
  const unsigned = `${header}.${claim}`;
  const signer = createSign("RSA-SHA256");
  signer.update(unsigned);
  const assertion = `${unsigned}.${signer.sign(config.googleServiceAccountPrivateKey, "base64url")}`;
  const response = await fetch(tokenApi, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new Error(`Google authorization failed (${response.status})`);
  const payload = await response.json() as { access_token?: string };
  if (!payload.access_token) throw new Error("Google authorization returned no access token");
  return payload.access_token;
}

async function request(path: string, init: RequestInit = {}) {
  const token = await accessToken();
  const response = await fetch(`${calendarApi}${path}`, {
    ...init,
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json", ...init.headers },
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok && response.status !== 404) {
    const detail = await response.text();
    throw new Error(`Google Calendar request failed (${response.status}): ${detail.slice(0, 200)}`);
  }
  return response;
}

export function googleCalendarEvent(appointment: CalendarAppointment) {
  return {
    summary: `${appointment.service.name} — ${appointment.customer.name}`,
    description: `Namaste Desk appointment\nCustomer: ${appointment.customer.name}\nPhone: ${appointment.customer.phone}\nStaff: ${appointment.staff.name}`,
    location: appointment.business.address,
    start: { dateTime: appointment.startsAt.toISOString(), timeZone: appointment.business.timezone },
    end: { dateTime: appointment.endsAt.toISOString(), timeZone: appointment.business.timezone },
    extendedProperties: { private: { namasteDeskAppointmentId: appointment.id } },
  };
}

export async function googleCalendarStatus() {
  if (!configured()) return { configured: false, connected: false, detail: "Add the Google service account and calendar environment variables" };
  try {
    const response = await request(`/calendars/${encodeURIComponent(config.googleCalendarId)}`);
    return response.ok
      ? { configured: true, connected: true, detail: "Connected and ready to sync appointments" }
      : { configured: true, connected: false, detail: "Calendar not found; share it with the service account" };
  } catch (error) {
    return { configured: true, connected: false, detail: error instanceof Error ? error.message : "Google Calendar connection failed" };
  }
}

export async function syncAppointmentToGoogle(appointment: CalendarAppointment) {
  if (!configured()) return { status: "LOCAL_ONLY" as const };
  try {
    const eventPath = appointment.externalCalendarEventId
      ? `/calendars/${encodeURIComponent(config.googleCalendarId)}/events/${encodeURIComponent(appointment.externalCalendarEventId)}`
      : `/calendars/${encodeURIComponent(config.googleCalendarId)}/events`;
    const response = await request(eventPath, { method: appointment.externalCalendarEventId ? "PUT" : "POST", body: JSON.stringify(googleCalendarEvent(appointment)) });
    const event = await response.json() as { id?: string };
    await db.appointment.update({
      where: { id: appointment.id },
      data: { externalCalendarEventId: event.id ?? appointment.externalCalendarEventId, calendarSyncStatus: "SYNCED" },
    });
    return { status: "SYNCED" as const, eventId: event.id };
  } catch (error) {
    await db.appointment.update({ where: { id: appointment.id }, data: { calendarSyncStatus: "FAILED" } });
    return { status: "FAILED" as const, error: error instanceof Error ? error.message : "Calendar sync failed" };
  }
}

export async function removeAppointmentFromGoogle(appointment: CalendarAppointment) {
  if (!configured() || !appointment.externalCalendarEventId) return { status: "LOCAL_ONLY" as const };
  try {
    await request(`/calendars/${encodeURIComponent(config.googleCalendarId)}/events/${encodeURIComponent(appointment.externalCalendarEventId)}`, { method: "DELETE" });
    await db.appointment.update({ where: { id: appointment.id }, data: { calendarSyncStatus: "DELETED" } });
    return { status: "DELETED" as const };
  } catch (error) {
    await db.appointment.update({ where: { id: appointment.id }, data: { calendarSyncStatus: "FAILED" } });
    return { status: "FAILED" as const, error: error instanceof Error ? error.message : "Calendar deletion failed" };
  }
}
