import { config } from "./config.js";

export type Language = "EN" | "HI" | "OR";

export interface LLMProvider {
  status(): Promise<{ available: boolean; detail: string }>;
  chat(messages: Array<{ role: string; content: string }>): Promise<string>;
}

export interface SpeechToTextProvider {
  transcribe(audio: Uint8Array, language: Language): Promise<string>;
  capability(language: Language): { available: boolean; tested: boolean; detail: string };
}

export interface TextToSpeechProvider {
  synthesize(text: string, language: Language): Promise<Uint8Array>;
  capability(language: Language): { available: boolean; tested: boolean; detail: string };
}

export interface MessagingProvider {
  send(phone: string, message: string): Promise<{ status: "SIMULATED" | "SENT"; providerId?: string }>;
}

export interface TelephonyProvider {
  capability(): { kind: "BROWSER_SIMULATOR"; pstn: false; detail: string };
}

export class OllamaProvider implements LLMProvider {
  async status() {
    try {
      const response = await fetch(`${config.ollamaUrl}/api/tags`, { signal: AbortSignal.timeout(1500) });
      if (!response.ok) return { available: false, detail: `Ollama returned ${response.status}` };
      const payload = (await response.json()) as { models?: Array<{ name: string }> };
      const found = payload.models?.some((m) => m.name.startsWith(config.ollamaModel.split(":")[0]));
      return { available: Boolean(found), detail: found ? `${config.ollamaModel} is installed` : `Install ${config.ollamaModel}` };
    } catch {
      return { available: false, detail: "Ollama is optional and is not running" };
    }
  }

  async chat(messages: Array<{ role: string; content: string }>) {
    const response = await fetch(`${config.ollamaUrl}/api/chat`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ model: config.ollamaModel, messages, stream: false }),
      signal: AbortSignal.timeout(45_000),
    });
    if (!response.ok) throw new Error(`Ollama request failed (${response.status})`);
    return ((await response.json()) as { message: { content: string } }).message.content;
  }
}

export class MockWhatsAppProvider implements MessagingProvider {
  async send(_phone: string, _message: string) { return { status: "SIMULATED" as const }; }
}

export class LocalVoiceCapability {
  capability(language: Language) {
    return {
      available: false,
      tested: false,
      detail: language === "OR"
        ? "Odia speech quality has not been validated; use text chat"
        : "Install and validate a local Whisper/Piper-compatible adapter; use text chat meanwhile",
    };
  }
}

export class BrowserTelephonyProvider implements TelephonyProvider {
  capability() {
    return { kind: "BROWSER_SIMULATOR" as const, pstn: false as const, detail: "Local browser simulation; no live telephone network" };
  }
}
