import { describe, expect, it } from "vitest";
import { confirmation, copy } from "./i18n.js";
import { BrowserTelephonyProvider, LocalVoiceCapability, MockWhatsAppProvider } from "./providers.js";

const date = new Date("2026-10-31T04:30:00.000Z");

describe("multilingual receptionist copy", () => {
  it.each(["EN", "HI", "OR"] as const)("has a complete %s text flow", (language) => {
    expect(copy[language].welcome).toBeTruthy();
    expect(copy[language].askName).toBeTruthy();
    expect(copy[language].askService).toBeTruthy();
    expect(copy[language].askDate).toBeTruthy();
  });

  it("uses the actual booking time in English", () => {
    expect(confirmation("EN", "Rahul", "ABC Clinic", date)).toContain("31 October 2026");
  });

  it("generates native-script Hindi and Odia confirmations", () => {
    expect(confirmation("HI", "राहुल", "ABC Clinic", date)).toContain("अपॉइंटमेंट");
    expect(confirmation("OR", "ରାହୁଲ", "ABC Clinic", date)).toContain("ଆପଏଣ୍ଟମେଣ୍ଟ");
  });
});

describe("free local provider behavior", () => {
  it("marks local WhatsApp output as simulated", async () => {
    expect(await new MockWhatsAppProvider().send("+911234567890", "hello")).toEqual({ status: "SIMULATED" });
  });

  it("does not claim untested Odia speech", () => {
    expect(new LocalVoiceCapability().capability("OR")).toMatchObject({ available: false, tested: false });
  });

  it("labels browser telephony as separate from PSTN", () => {
    expect(new BrowserTelephonyProvider().capability().pstn).toBe(false);
  });
});
