import { describe, expect, it } from "vitest";
import { incomingCallTwiml } from "./twilio.js";

describe("Twilio voice entrypoint", () => {
  it("returns TwiML with language selection and an API webhook", async () => {
    const xml = await incomingCallTwiml();

    expect(xml).toContain("<Response>");
    expect(xml).toContain('input="dtmf"');
    expect(xml).toContain("/api/telephony/twilio/language");
    expect(xml).toContain("Press 1 for English");
    expect(xml).toContain("हिंदी के लिए 2 दबाएं");
  });
});
