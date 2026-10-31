import { describe, expect, it } from "vitest";
import { googleCalendarEvent } from "./google-calendar.js";

describe("Google Calendar event mapping", () => {
  it("includes the booking details and stable local appointment ID", () => {
    const event = googleCalendarEvent({
      id: "appointment-1",
      startsAt: new Date("2026-11-02T03:30:00.000Z"),
      endsAt: new Date("2026-11-02T04:00:00.000Z"),
      externalCalendarEventId: null,
      business: { name: "ABC Clinic", address: "Bhubaneswar", timezone: "Asia/Kolkata" },
      customer: { name: "Test User", phone: "+919876543210" },
      service: { name: "General Consultation" },
      staff: { name: "Dr. Ananya Das" },
    });

    expect(event).toMatchObject({
      summary: "General Consultation — Test User",
      location: "Bhubaneswar",
      start: { dateTime: "2026-11-02T03:30:00.000Z", timeZone: "Asia/Kolkata" },
      extendedProperties: { private: { namasteDeskAppointmentId: "appointment-1" } },
    });
  });
});
