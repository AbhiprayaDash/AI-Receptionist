import type { Language } from "./providers.js";

export const copy = {
  EN: {
    welcome: "Welcome to ABC Clinic. Please choose English, Hindi, or Odia.",
    askName: "What is your name?",
    askPhone: "What WhatsApp phone number should we use?",
    askService: "Which service do you need?",
    askDate: "Which date would you prefer? Please use YYYY-MM-DD.",
    askTime: "Available times are: {slots}. Which time would you like?",
    noSlots: "That date has no available slots. Please choose another date.",
    confirm: "Your appointment is confirmed for {date}. A simulated WhatsApp message is ready.",
    unclear: "I did not understand that. Please answer the current booking question.",
  },
  HI: {
    welcome: "ABC Clinic में आपका स्वागत है। कृपया हिंदी, English या ଓଡ଼ିଆ चुनें।",
    askName: "आपका नाम क्या है?",
    askPhone: "WhatsApp के लिए आपका फ़ोन नंबर क्या है?",
    askService: "आपको कौन सी सेवा चाहिए?",
    askDate: "आप किस तारीख को आना चाहेंगे? कृपया YYYY-MM-DD लिखें।",
    askTime: "उपलब्ध समय हैं: {slots}। आप कौन सा समय चुनेंगे?",
    noSlots: "उस तारीख को कोई समय उपलब्ध नहीं है। कृपया दूसरी तारीख चुनें।",
    confirm: "आपकी अपॉइंटमेंट {date} के लिए कन्फर्म हो गई है। नकली WhatsApp संदेश तैयार है।",
    unclear: "मैं समझ नहीं पाया। कृपया मौजूदा बुकिंग प्रश्न का उत्तर दें।",
  },
  OR: {
    welcome: "ABC Clinic କୁ ସ୍ୱାଗତ। ଦୟାକରି English, हिंदी କିମ୍ବା ଓଡ଼ିଆ ବାଛନ୍ତୁ।",
    askName: "ଆପଣଙ୍କ ନାମ କଣ?",
    askPhone: "WhatsApp ପାଇଁ ଆପଣଙ୍କ ଫୋନ୍ ନମ୍ବର କଣ?",
    askService: "ଆପଣଙ୍କୁ କେଉଁ ସେବା ଦରକାର?",
    askDate: "ଆପଣ କେଉଁ ତାରିଖରେ ଆସିବାକୁ ଚାହାନ୍ତି? YYYY-MM-DD ଲେଖନ୍ତୁ।",
    askTime: "ଉପଲବ୍ଧ ସମୟ: {slots}। ଆପଣ କେଉଁ ସମୟ ବାଛିବେ?",
    noSlots: "ସେହି ତାରିଖରେ ସମୟ ଉପଲବ୍ଧ ନାହିଁ। ଅନ୍ୟ ତାରିଖ ବାଛନ୍ତୁ।",
    confirm: "ଆପଣଙ୍କ ଆପଏଣ୍ଟମେଣ୍ଟ {date} ପାଇଁ ନିଶ୍ଚିତ ହୋଇଛି। ସିମୁଲେଟେଡ୍ WhatsApp ସନ୍ଦେଶ ପ୍ରସ୍ତୁତ।",
    unclear: "ମୁଁ ବୁଝି ପାରିଲି ନାହିଁ। ବର୍ତ୍ତମାନର ବୁକିଂ ପ୍ରଶ୍ନର ଉତ୍ତର ଦିଅନ୍ତୁ।",
  },
} satisfies Record<Language, Record<string, string>>;

export function confirmation(language: Language, name: string, business: string, startsAt: Date) {
  const date = new Intl.DateTimeFormat(language === "HI" ? "hi-IN" : language === "OR" ? "or-IN" : "en-IN", {
    dateStyle: "long", timeStyle: "short", timeZone: "Asia/Kolkata",
  }).format(startsAt);
  if (language === "HI") return `नमस्ते ${name}, ${business} में आपकी अपॉइंटमेंट ${date} के लिए कन्फर्म हो गई है। धन्यवाद!`;
  if (language === "OR") return `ନମସ୍କାର ${name}, ${business} ରେ ଆପଣଙ୍କ ଆପଏଣ୍ଟମେଣ୍ଟ ${date} ପାଇଁ ନିଶ୍ଚିତ ହୋଇଛି। ଧନ୍ୟବାଦ!`;
  return `Hello ${name}, your appointment at ${business} is confirmed for ${date}. Thank you!`;
}
