import { createHmac, timingSafeEqual } from "node:crypto";
import type { FastifyRequest } from "fastify";
import { config } from "./config.js";
import { db } from "./db.js";
import { handleMessage, startConversation } from "./conversation.js";
import type { Language } from "./providers.js";

type FormBody = Record<string, string>;
type BookingStep = "NAME" | "PHONE" | "SERVICE" | "DATE" | "TIME" | "COMPLETE";

const escapeXml = (value: string) => value.replace(/[<>&'\"]/g, (character) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", "\"": "&quot;" })[character]!);
const configured = () => Boolean(config.publicAppUrl && config.twilioAccountSid && config.twilioAuthToken && config.twilioPhoneNumber);
const webhookUrl = (path: string) => `${config.publicAppUrl}/api/telephony/twilio${path}`;
const voiceLanguage = (language: Language) => language === "HI" ? "hi-IN" : "en-IN";

export function verifyTwilioRequest(request: FastifyRequest) {
  if (!config.twilioAuthToken || !config.publicAppUrl) return false;
  const signature = request.headers["x-twilio-signature"];
  if (typeof signature !== "string") return false;
  const url = `${config.publicAppUrl}/api${request.url}`;
  const body = (request.body ?? {}) as FormBody;
  const signed = Object.keys(body).sort().reduce((value, key) => `${value}${key}${body[key]}`, url);
  const expected = createHmac("sha1", config.twilioAuthToken).update(signed).digest("base64");
  const suppliedBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  return suppliedBuffer.length === expectedBuffer.length && timingSafeEqual(suppliedBuffer, expectedBuffer);
}

function gather(message: string, language: Language, sessionId: string, step: BookingStep) {
  const attributes = step === "NAME"
    ? `input="speech" language="${voiceLanguage(language)}" speechTimeout="auto"`
    : step === "SERVICE"
      ? `input="dtmf" numDigits="1"`
      : step === "DATE"
        ? `input="dtmf" numDigits="8"`
        : step === "TIME"
          ? `input="dtmf" numDigits="4"`
          : `input="dtmf" finishOnKey="#"`;
  const instructions = step === "PHONE"
    ? " Enter the phone number, then press hash."
    : step === "DATE"
      ? " Enter eight digits: four digit year, two digit month, and two digit day."
      : step === "TIME"
        ? " Enter four digits in twenty four hour time."
        : "";
  const action = `${webhookUrl("/respond")}?sessionId=${encodeURIComponent(sessionId)}&language=${language}`;
  return `<Gather ${attributes} action="${escapeXml(action)}" method="POST"><Say language="${voiceLanguage(language)}">${escapeXml(message + instructions)}</Say></Gather><Redirect method="POST">${escapeXml(action)}</Redirect>`;
}

const response = (content: string) => `<?xml version="1.0" encoding="UTF-8"?><Response>${content}</Response>`;

export async function incomingCallTwiml() {
  const action = webhookUrl("/language");
  return response(`<Gather input="dtmf" numDigits="1" action="${escapeXml(action)}" method="POST"><Say language="en-IN">Welcome to ABC Clinic. Press 1 for English.</Say><Say language="hi-IN">हिंदी के लिए 2 दबाएं।</Say><Say language="en-IN">For Odia, press 3.</Say></Gather><Redirect method="POST">${escapeXml(webhookUrl("/incoming"))}</Redirect>`);
}

export async function selectLanguageTwiml(digit: string) {
  const language: Language = digit === "2" ? "HI" : digit === "3" ? "OR" : "EN";
  const business = await db.business.findFirst({ where: { tenant: { name: "ABC Clinic Demo" } } });
  if (!business) return response(`<Say>Demo business is unavailable.</Say><Hangup/>`);
  const conversation = await startConversation(business.id, language, "TWILIO_VOICE");
  return response(gather(conversation.message, language, conversation.sessionId, conversation.nextStep));
}

export async function respondTwiml(sessionId: string, language: Language, form: FormBody) {
  const session = await db.conversationSession.findUnique({ where: { id: sessionId }, select: { state: true } });
  if (!session) return response(`<Say>Conversation not found.</Say><Hangup/>`);
  const currentStep = ((session.state as { step?: BookingStep }).step ?? "NAME");
  let answer = (form.SpeechResult || form.Digits || "").trim();
  if (!answer) return response(gather("I did not receive a response. Please try again.", language, sessionId, currentStep));
  if (currentStep === "DATE" && /^\d{8}$/.test(answer)) answer = `${answer.slice(0, 4)}-${answer.slice(4, 6)}-${answer.slice(6)}`;
  if (currentStep === "TIME" && /^\d{4}$/.test(answer)) answer = `${answer.slice(0, 2)}:${answer.slice(2)}`;
  const result = await handleMessage(sessionId, answer);
  if (result.complete) return response(`<Say language="${voiceLanguage(language)}">${escapeXml(result.message)}</Say><Hangup/>`);
  return response(gather(result.message, language, sessionId, result.nextStep ?? currentStep));
}

async function twilioRequest(path: string, init: RequestInit = {}) {
  if (!configured()) throw new Error("Twilio credentials are not configured");
  return fetch(`https://api.twilio.com/2010-04-01${path}`, {
    ...init,
    headers: { authorization: `Basic ${Buffer.from(`${config.twilioAccountSid}:${config.twilioAuthToken}`).toString("base64")}`, "content-type": "application/x-www-form-urlencoded", ...init.headers },
    signal: AbortSignal.timeout(10_000),
  });
}

export async function twilioStatus() {
  if (!configured()) return { configured: false, connected: false, pstn: false, detail: "Add the Twilio account, token, phone number, and public app URL" };
  try {
    const result = await twilioRequest(`/Accounts/${encodeURIComponent(config.twilioAccountSid)}.json`);
    return result.ok
      ? { configured: true, connected: true, pstn: true, detail: "Twilio voice is connected" }
      : { configured: true, connected: false, pstn: false, detail: `Twilio rejected the credentials (${result.status})` };
  } catch (error) {
    return { configured: true, connected: false, pstn: false, detail: error instanceof Error ? error.message : "Twilio connection failed" };
  }
}

export async function createOutboundCall(to: string) {
  const result = await twilioRequest(`/Accounts/${encodeURIComponent(config.twilioAccountSid)}/Calls.json`, {
    method: "POST",
    body: new URLSearchParams({ To: to, From: config.twilioPhoneNumber, Url: webhookUrl("/incoming"), Method: "POST" }),
  });
  const payload = await result.json() as { sid?: string; status?: string; message?: string };
  if (!result.ok || !payload.sid) throw new Error(payload.message ?? `Twilio call failed (${result.status})`);
  return { callSid: payload.sid, status: payload.status ?? "queued" };
}
