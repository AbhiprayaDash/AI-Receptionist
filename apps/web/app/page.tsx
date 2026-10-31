"use client";

import { useCallback, useEffect, useState } from "react";
import { CalendarDays, LayoutDashboard, PhoneCall, Settings, Users, Plug, Bell, Send, ShieldCheck, Mic, Volume2, VolumeX } from "lucide-react";

const API = process.env.NEXT_PUBLIC_API_URL ?? (process.env.NODE_ENV === "production" ? "/api" : "http://localhost:4000");
type View = "dashboard" | "receptionist" | "calendar" | "customers" | "notifications" | "integrations" | "settings";
type Message = { role: "assistant" | "user"; content: string };
type Appointment = { id: string; startsAt: string; status: string; calendarSyncStatus: string; customer: { name: string; phone: string }; service: { name: string }; staff: { name: string }; notifications: Array<{ manualUrl: string }> };

const nav: Array<[View, string, typeof LayoutDashboard]> = [
  ["dashboard", "Dashboard", LayoutDashboard], ["receptionist", "AI Receptionist", PhoneCall], ["calendar", "Calendar", CalendarDays],
  ["customers", "Customers", Users], ["notifications", "Notifications", Bell], ["integrations", "Integrations", Plug], ["settings", "Business Settings", Settings],
];

export default function Home() {
  const [view, setView] = useState<View>("dashboard");
  const [token, setToken] = useState("");
  const [demo, setDemo] = useState<any>(null);
  const [dashboard, setDashboard] = useState<any>(null);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [integrations, setIntegrations] = useState<any>(null);
  const [error, setError] = useState("");

  const api = useCallback(async (path: string, options: RequestInit = {}) => {
    const response = await fetch(`${API}${path}`, { ...options, headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}), ...options.headers } });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error ?? "Request failed");
    return data;
  }, [token]);

  const refresh = useCallback(async (activeToken?: string) => {
    const authToken = activeToken ?? token;
    if (!authToken) return;
    const headers = { authorization: `Bearer ${authToken}` };
    const [dash, appts, people, notes, status] = await Promise.all([
      fetch(`${API}/dashboard`, { headers }).then(r => r.json()), fetch(`${API}/appointments`, { headers }).then(r => r.json()),
      fetch(`${API}/customers`, { headers }).then(r => r.json()), fetch(`${API}/notifications`, { headers }).then(r => r.json()),
      fetch(`${API}/integrations/status`).then(r => r.json()),
    ]);
    setDashboard(dash); setAppointments(appts); setCustomers(people); setNotifications(notes); setIntegrations(status);
  }, [token]);

  useEffect(() => {
    Promise.all([
      fetch(`${API}/demo`).then(r => r.json()),
      fetch(`${API}/auth/login`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email: "owner@abc-clinic.local", password: "demo1234" }) }).then(r => r.json()),
    ]).then(([demoData, login]) => { setDemo(demoData); setToken(login.token); return refresh(login.token); }).catch(e => setError(e.message));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return <div className="shell">
    <aside className="sidebar">
      <div className="brand"><div className="brand-mark"><PhoneCall size={20}/></div> Namaste Desk</div>
      <nav className="nav">{nav.map(([id, label, Icon]) => <button key={id} className={view === id ? "active" : ""} onClick={() => setView(id)}><Icon size={17}/><span>{label}</span></button>)}</nav>
      <div className="local-note"><ShieldCheck size={16}/><br/>Local-first demo<br/>No paid API key required. Messages are simulated until a production provider is configured.</div>
    </aside>
    <main className="main">
      {error && <div className="error">{error}</div>}
      {view === "dashboard" && <Dashboard data={dashboard} onStart={() => setView("receptionist")}/>} 
      {view === "receptionist" && <Receptionist business={demo} api={api} onBooked={() => refresh()}/>} 
      {view === "calendar" && <Appointments rows={appointments} api={api} refresh={refresh}/>} 
      {view === "customers" && <Customers rows={customers}/>} 
      {view === "notifications" && <Notifications rows={notifications}/>} 
      {view === "integrations" && <Integrations data={integrations}/>} 
      {view === "settings" && <SettingsPage business={dashboard?.business}/>} 
    </main>
  </div>;
}

function Header({ eyebrow, title, subtitle }: { eyebrow: string; title: string; subtitle: string }) { return <><div className="eyebrow">{eyebrow}</div><h1>{title}</h1><p className="subtitle">{subtitle}</p></>; }

function Dashboard({ data, onStart }: { data: any; onStart(): void }) {
  const stats = data?.stats ?? {};
  return <><Header eyebrow="Fictional demo clinic" title={`Good day, ${data?.business?.name ?? "ABC Clinic"}`} subtitle="Appointments and receptionist activity in Asia/Kolkata."/>
    <div className="grid stats">{[["Total appointments", stats.total ?? 0], ["Today", stats.today ?? 0], ["Upcoming", stats.upcoming ?? 0], ["Booking conversion", `${stats.conversionPercent ?? 0}%`]].map(([label, value]) => <div className="card stat" key={label}><span>{label}</span><strong>{value}</strong></div>)}</div>
    <div className="grid two-col"><section className="card hero"><div className="eyebrow" style={{color:"#d8f18a"}}>Try the complete flow</div><h2>Book in English, हिंदी, or ଓଡ଼ିଆ</h2><p>The text receptionist checks the real local schedule, creates the appointment, and prepares a manual WhatsApp message.</p><button className="primary" onClick={onStart}>Start simulated call</button></section>
    <section className="card"><h2 className="section-title">Local demo status</h2><div className="status-list"><div className="status"><span>PostgreSQL calendar</span><b className="pill">Connected</b></div><div className="status"><span>WhatsApp messages</span><b className="pill warn">Simulated</b></div><div className="status"><span>Live telephone network</span><b className="pill warn">Not configured</b></div><div className="status"><span>Text fallback</span><b className="pill">Ready</b></div></div></section></div>
  </>;
}

function Receptionist({ business, api, onBooked }: { business: any; api: any; onBooked(): void }) {
  const [session, setSession] = useState(""); const [messages, setMessages] = useState<Message[]>([]); const [input, setInput] = useState(""); const [busy, setBusy] = useState(false); const [result, setResult] = useState<any>(null);
  const [language, setLanguage] = useState<"EN"|"HI"|"OR">("EN"); const [voice, setVoice] = useState(false); const [speechSupported, setSpeechSupported] = useState(false); const [listening, setListening] = useState(false);
  useEffect(() => { setSpeechSupported("speechSynthesis" in window && Boolean((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition)); }, []);
  const locale = language === "HI" ? "hi-IN" : language === "OR" ? "or-IN" : "en-IN";
  const speak = (content: string) => { if (!voice || !("speechSynthesis" in window)) return; window.speechSynthesis.cancel(); const utterance = new SpeechSynthesisUtterance(content); utterance.lang = locale; window.speechSynthesis.speak(utterance); };
  const begin = async (selected: "EN"|"HI"|"OR") => { setBusy(true); setLanguage(selected); try { const data = await api("/conversations", { method: "POST", body: JSON.stringify({ businessId: business.businessId, language: selected }) }); setSession(data.sessionId); setMessages([{ role: "assistant", content: data.message }]); setResult(null); if (voice && "speechSynthesis" in window) { const utterance = new SpeechSynthesisUtterance(data.message); utterance.lang = selected === "HI" ? "hi-IN" : selected === "OR" ? "or-IN" : "en-IN"; window.speechSynthesis.speak(utterance); } } finally { setBusy(false); } };
  const send = async () => { if (!input.trim() || !session) return; const content = input; setInput(""); setMessages(m => [...m, { role:"user", content }]); setBusy(true); try { const data = await api(`/conversations/${session}/messages`, { method:"POST", body: JSON.stringify({ content }) }); setMessages(m => [...m, { role:"assistant", content: data.message }]); speak(data.message); if (data.complete) { setResult(data.notification); onBooked(); } } finally { setBusy(false); } };
  const listen = () => { const Recognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition; if (!Recognition) return; const recognition = new Recognition(); recognition.lang = locale; recognition.interimResults = false; recognition.onstart = () => setListening(true); recognition.onend = () => setListening(false); recognition.onerror = () => setListening(false); recognition.onresult = (event: any) => setInput(event.results[0][0].transcript); recognition.start(); };
  return <><Header eyebrow="Browser call simulator" title="AI Receptionist" subtitle="Speak and listen in the browser, or use text. This does not place a telephone-network call."/>
    {!session ? <section className="card"><h2 className="section-title">Choose your language</h2><div className="language-grid"><button className="language" disabled={busy || !business} onClick={() => begin("EN")}><strong>English</strong><span>Press 1</span></button><button className="language" disabled={busy || !business} onClick={() => begin("HI")}><strong>हिंदी</strong><span>2 दबाएं</span></button><button className="language" disabled={busy || !business} onClick={() => begin("OR")}><strong>ଓଡ଼ିଆ</strong><span>3 ଦବାନ୍ତୁ</span></button></div></section> :
    <div className="grid two-col"><section className="card chat"><div className="notice">Browser voice {speechSupported ? "available" : "is not supported by this browser"} · allow microphone access when prompted <button className="secondary" disabled={!speechSupported} onClick={() => { setVoice(v => !v); window.speechSynthesis?.cancel(); }}>{voice ? <Volume2 size={15}/> : <VolumeX size={15}/>} {voice ? "Voice on" : "Voice off"}</button></div><div className="messages">{messages.map((m,i)=><div className={`bubble ${m.role}`} key={i}>{m.content}</div>)}</div><div className="composer"><button className="secondary" onClick={listen} disabled={!speechSupported || busy || Boolean(result)} title="Speak your reply"><Mic size={17}/> {listening ? "Listening…" : "Speak"}</button><input value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>e.key==="Enter"&&send()} placeholder="Type or speak your reply…" disabled={busy || Boolean(result)}/><button className="primary" onClick={send} disabled={busy || Boolean(result)}><Send size={17}/></button></div></section><aside className="card"><h2 className="section-title">Booking workflow</h2><div className="status-list"><div className="status"><span>Language</span><b className="pill">Selected</b></div><div className="status"><span>Availability</span><b className="pill">From database</b></div><div className="status"><span>Google Calendar</span><b className="pill">Optional sync</b></div><div className="status"><span>WhatsApp</span><b className="pill warn">Simulated</b></div></div>{result && <div className="notification" style={{marginTop:18}}><b>Confirmation prepared</b><p>{result.message}</p><a className="secondary" href={result.manualUrl} target="_blank">Open manual WhatsApp link</a></div>}<button className="secondary" style={{marginTop:18}} onClick={()=>{setSession("");setMessages([]);setResult(null);window.speechSynthesis?.cancel()}}>Start over</button></aside></div>}
  </>;
}

function Appointments({ rows, api, refresh }: { rows: Appointment[]; api: any; refresh(): void }) { const cancel = async (id:string) => { await api(`/appointments/${id}/cancel`, {method:"POST"}); refresh(); }; return <><Header eyebrow="Local and Google calendar" title="Appointments" subtitle="Bookings are stored in PostgreSQL and synced to Google Calendar when configured."/><section className="card">{!rows.length ? <div className="empty">No appointments yet. Complete a receptionist conversation to add one.</div> : <table className="table"><thead><tr><th>Customer</th><th>Service</th><th>Date and time</th><th>Staff</th><th>Status</th><th>Google</th><th></th></tr></thead><tbody>{rows.map(a=><tr key={a.id}><td><b>{a.customer.name}</b><br/><small>{a.customer.phone}</small></td><td>{a.service.name}</td><td>{new Intl.DateTimeFormat("en-IN",{dateStyle:"medium",timeStyle:"short",timeZone:"Asia/Kolkata"}).format(new Date(a.startsAt))}</td><td>{a.staff.name}</td><td><span className={`pill ${a.status!=="CONFIRMED"?"warn":""}`}>{a.status}</span></td><td><span className={`pill ${a.calendarSyncStatus!=="SYNCED"?"warn":""}`}>{a.calendarSyncStatus}</span></td><td>{a.status==="CONFIRMED"&&<button className="secondary" onClick={()=>cancel(a.id)}>Cancel</button>}</td></tr>)}</tbody></table>}</section></>; }
function Customers({ rows }: { rows:any[] }) { return <><Header eyebrow="Relationships" title="Customers" subtitle="Language preference and appointment history for this tenant."/><section className="card">{!rows.length?<div className="empty">Customers appear after a booking.</div>:<table className="table"><thead><tr><th>Name</th><th>Phone</th><th>Language</th><th>Appointments</th></tr></thead><tbody>{rows.map(c=><tr key={c.id}><td><b>{c.name}</b></td><td>{c.phone}</td><td>{c.language}</td><td>{c.appointments.length}</td></tr>)}</tbody></table>}</section></>; }
function Notifications({ rows }: { rows:any[] }) { return <><Header eyebrow="Messaging" title="WhatsApp confirmations" subtitle="Messages are generated and stored locally. Simulated means they were not delivered."/><div className="grid">{!rows.length?<div className="card empty">No confirmations yet.</div>:rows.map(n=><article className="card notification" key={n.id}><div><span className="pill warn">{n.status} · NOT DELIVERED</span></div><b>{n.appointment.customer.name}</b><p>{n.message}</p><div><a className="secondary" href={n.manualUrl} target="_blank">Open click-to-chat</a></div></article>)}</div></>; }
function Integrations({ data }: { data:any }) { const speech = data?.speech ?? {}; const calendar = data?.googleCalendar; return <><Header eyebrow="Provider adapters" title="Integrations" subtitle="Optional providers report their real connection state."/><div className="grid two-col"><section className="card"><h2 className="section-title">AI and browser voice</h2><div className="status-list"><div className="status"><span>Ollama / Qwen</span><b className={`pill ${data?.ollama?.available?"":"warn"}`}>{data?.ollama?.available?"Ready":"Optional"}</b></div><p className="subtitle">{data?.ollama?.detail}</p><div className="status"><span>English browser speech</span><b className="pill">Browser dependent</b></div><div className="status"><span>Hindi browser speech</span><b className="pill">Browser dependent</b></div><div className="status"><span>Odia browser speech</span><b className="pill warn">Unvalidated</b></div><p className="subtitle">{speech.OR?.detail}</p></div></section><section className="card"><h2 className="section-title">External services</h2><div className="status-list"><div className="status"><span>Google Calendar</span><b className={`pill ${calendar?.connected?"":"warn"}`}>{calendar?.connected?"Connected":calendar?.configured?"Needs attention":"Not configured"}</b></div><p className="subtitle">{calendar?.detail}</p><div className="status"><span>WhatsApp Cloud API</span><b className="pill warn">Disabled</b></div><div className="status"><span>Browser voice</span><b className="pill">Available</b></div><div className="status"><span>Telephone network</span><b className="pill warn">Provider required</b></div></div></section></div></>; }
function SettingsPage({ business }: { business:any }) { return <><Header eyebrow="Business configuration" title="Business Settings" subtitle="The seeded clinic and all records are fictional."/><div className="grid two-col"><section className="card"><h2 className="section-title">Profile</h2><label>Name<input className="field" value={business?.name??""} readOnly/></label><br/><label>Address<input className="field" value={business?.address??""} readOnly/></label><br/><label>Timezone<input className="field" value={business?.timezone??"Asia/Kolkata"} readOnly/></label></section><section className="card"><h2 className="section-title">Supported languages</h2><div className="status-list"><div className="status"><span>English text</span><b className="pill">Enabled</b></div><div className="status"><span>हिंदी text</span><b className="pill">Enabled</b></div><div className="status"><span>ଓଡ଼ିଆ text</span><b className="pill">Enabled</b></div></div></section></div></>; }
