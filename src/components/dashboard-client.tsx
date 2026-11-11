"use client";

import { signOut } from "@/app/actions";
import { createClient } from "@/lib/supabase/client";

import { useEffect, useMemo, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import {
  Activity, ArrowUpRight, Bell, BriefcaseBusiness, CalendarDays, Check,
  ChevronRight, CircleHelp, Clock3, Cloud, CloudOff, Command, FileText,
  LayoutDashboard, ListTodo, MessageCircle, Plus, Search, Send,
  Settings2, ShieldCheck, Sparkles, Target, X
} from "lucide-react";

type Prospect = {
  id: string; company: string; contact: string; industry: string; stage: string;
  nextStep: string; source: string; updatedAt: string;
};
type Draft = { id: string; company: string; channel: string; message: string; status: "Needs approval" | "Approved"; createdAt: string };
type Task = { id: string; title: string; due: string; done: boolean };

function localDateString(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatTaskDate(value: string) {
  if (!/^\\d{4}-\\d{2}-\\d{2}$/.test(value)) return value;
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short", year: "numeric" });
}

const initialProspects: Prospect[] = [
  { id: "p1", company: "Example Construction Ltd", contact: "Contact to verify", industry: "Construction", stage: "Research", nextStep: "Verify official contact and service fit", source: "Sample data — replace before outreach", updatedAt: "Today" },
  { id: "p2", company: "Example Medical Centre", contact: "Contact to verify", industry: "Healthcare", stage: "New prospect", nextStep: "Research company needs", source: "Sample data — replace before outreach", updatedAt: "Today" },
];
const initialDrafts: Draft[] = [
  { id: "d1", company: "Example Construction Ltd", channel: "WhatsApp", message: "Hello, I’m reaching out from Johden Business Consultancy Services. We support businesses with practical business and technology solutions. Would you be open to a brief conversation about your current needs? If this is not relevant, please let me know.", status: "Needs approval", createdAt: "Today" },
];
const initialTasks: Task[] = [
  { id: "t1", title: "Review and verify the first prospect records", due: "Today", done: false },
  { id: "t2", title: "Confirm calendar and WhatsApp integration options", due: "This week", done: false },
  { id: "t3", title: "Add the official Johden business profile details", due: "This week", done: true },
];

const nav = [
  { name: "Overview", icon: LayoutDashboard },
  { name: "Prospects", icon: Target },
  { name: "Message approvals", icon: MessageCircle },
  { name: "Tasks", icon: ListTodo },
  { name: "Calendar", icon: CalendarDays },
  { name: "Activity log", icon: Activity },
  { name: "Settings", icon: Settings2 },
];

export default function DashboardClient({ userId, userEmail }: { userId: string; userEmail: string }) {
  const [active, setActive] = useState("Overview");
  const [prospects, setProspects] = useState<Prospect[]>(initialProspects);
  const [drafts, setDrafts] = useState<Draft[]>(initialDrafts);
  const [tasks, setTasks] = useState<Task[]>(initialTasks);
  const [query, setQuery] = useState("");
  const [showProspectForm, setShowProspectForm] = useState(false);
  const [company, setCompany] = useState("");
  const [contact, setContact] = useState("");
  const [industry, setIndustry] = useState("Professional services");
  const [taskText, setTaskText] = useState("");
  const [taskDate, setTaskDate] = useState(() => localDateString());
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [online, setOnline] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const [notice, setNotice] = useState("");
  const [calendarConnected, setCalendarConnected] = useState(false);
  const [calendarLoading, setCalendarLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setOnline(navigator.onLine);
    const onOnline = () => setOnline(true);
    const onOffline = () => setOnline(false);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);

    async function loadWorkspace() {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("johden_workspace_data")
        .select("prospects,drafts,tasks")
        .eq("user_id", userId)
        .maybeSingle();

      if (cancelled) return;
      if (error) {
        setNotice("Cloud data could not be loaded. Your device copy is still available.");
        try {
          const cached = localStorage.getItem(`johden-ai-workspace-v1:${userId}`);
          if (cached) {
            const parsed = JSON.parse(cached);
            if (Array.isArray(parsed.prospects)) setProspects(parsed.prospects);
            if (Array.isArray(parsed.drafts)) setDrafts(parsed.drafts);
            if (Array.isArray(parsed.tasks)) setTasks(parsed.tasks);
          }
        } catch { /* Keep starter data if local cache is unavailable. */ }
      } else if (data) {
        setProspects(Array.isArray(data.prospects) ? data.prospects : []);
        setDrafts(Array.isArray(data.drafts) ? data.drafts : []);
        setTasks(Array.isArray(data.tasks) ? data.tasks : []);
      } else {
        // Migrate this account's existing device data on its first cloud visit.
        let cached: { prospects?: Prospect[]; drafts?: Draft[]; tasks?: Task[] } | null = null;
        try {
          const raw = localStorage.getItem(`johden-ai-workspace-v1:${userId}`);
          if (raw) cached = JSON.parse(raw);
        } catch { /* Ignore an invalid local cache. */ }
        const initial = {
          prospects: Array.isArray(cached?.prospects) ? cached.prospects : initialProspects,
          drafts: Array.isArray(cached?.drafts) ? cached.drafts : initialDrafts,
          tasks: Array.isArray(cached?.tasks) ? cached.tasks : initialTasks,
        };
        setProspects(initial.prospects);
        setDrafts(initial.drafts);
        setTasks(initial.tasks);
        const { error: migrationError } = await supabase.from("johden_workspace_data").upsert(
          { user_id: userId, ...initial, updated_at: new Date().toISOString() },
          { onConflict: "user_id" }
        );
        if (cancelled) return;
        if (migrationError) setNotice("Your device data is available, but its first cloud save needs attention.");
        else setNotice("Your existing workspace has been copied to secure cloud storage.");
      }
      if (!cancelled) setLoaded(true);
    }

    loadWorkspace().catch(() => {
      if (!cancelled) {
        setNotice("Cloud connection unavailable. Changes will stay on this device until it reconnects.");
        setLoaded(true);
      }
    });
    return () => {
      cancelled = true;
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, [userId]);

  useEffect(() => {
    if (!loaded) return;
    const snapshot = { prospects, drafts, tasks };
    try { localStorage.setItem(`johden-ai-workspace-v1:${userId}`, JSON.stringify(snapshot)); } catch { /* Browser storage may be unavailable. */ }
    if (!online) return;
    const timeout = window.setTimeout(async () => {
      const supabase = createClient();
      const { error } = await supabase.from("johden_workspace_data").upsert(
        { user_id: userId, ...snapshot, updated_at: new Date().toISOString() },
        { onConflict: "user_id" }
      );
      if (error) setNotice("Cloud save failed. Your latest changes remain on this device.");
    }, 500);
    return () => window.clearTimeout(timeout);
  }, [prospects, drafts, tasks, loaded, userId, online]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const result = params.get("calendar");
    if (result === "connected") setNotice("Google Calendar connected successfully.");
    else if (result && result !== "cancelled") setNotice("Google Calendar connection needs attention (" + result.replaceAll("_", " ") + ").");
    if (result) window.history.replaceState({}, "", window.location.pathname);
    fetch("/api/google/calendar/status", { cache: "no-store" })
      .then((response) => response.ok ? response.json() : Promise.reject())
      .then((data) => setCalendarConnected(Boolean(data.connected)))
      .catch(() => setCalendarConnected(false))
      .finally(() => setCalendarLoading(false));
  }, []);

  async function disconnectCalendar() {
    setCalendarLoading(true);
    try {
      const response = await fetch("/api/google/calendar/disconnect", { method: "POST" });
      if (!response.ok) throw new Error("Disconnect failed");
      setCalendarConnected(false);
      setNotice("Google Calendar disconnected.");
    } catch {
      setNotice("Could not disconnect Google Calendar. Please try again.");
    } finally {
      setCalendarLoading(false);
    }
  }

  const pending = drafts.filter((d) => d.status === "Needs approval").length;
  const filteredProspects = useMemo(() => prospects.filter((p) => [p.company, p.contact, p.industry, p.stage].join(" ").toLowerCase().includes(query.toLowerCase())), [prospects, query]);

  function addProspect(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!company.trim()) return;
    setProspects((old) => [{ id: crypto.randomUUID(), company: company.trim(), contact: contact.trim() || "Not yet verified", industry, stage: "New prospect", nextStep: "Research company and verify contact", source: "Manually added", updatedAt: "Just now" }, ...old]);
    setCompany(""); setContact(""); setShowProspectForm(false); setActive("Prospects");
    setNotice("Prospect saved. Syncing securely to your account."); setTimeout(() => setNotice(""), 3500);
  }
  function addTask(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!taskText.trim()) return;
    setTasks((old) => [{ id: crypto.randomUUID(), title: taskText.trim(), due: taskDate, done: false }, ...old]);
    setTaskText(""); setTaskDate(localDateString()); setShowTaskForm(false); setNotice("Task saved. Syncing securely to your account."); setTimeout(() => setNotice(""), 3500);
  }
  function approveDraft(id: string) {
    setDrafts((old) => old.map((d) => d.id === id ? { ...d, status: "Approved" } : d));
    setNotice("Draft approved. No message was sent."); setTimeout(() => setNotice(""), 3500);
  }

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="brand"><div className="brand-mark">J</div><div><strong>JOHDEN</strong><span>AI BUSINESS MANAGER</span></div></div>
        <div className="workspace-label">WORKSPACE</div>
        <div className="workspace-card"><div className="workspace-avatar">JB</div><div className="workspace-name"><strong>Johden Business</strong><span>Owner workspace</span></div><ChevronRight size={16} /></div>
        <nav className="nav-list" aria-label="Main navigation">
          {nav.map((item) => { const Icon = item.icon; return <button key={item.name} className={active === item.name ? "nav-item active" : "nav-item"} onClick={() => setActive(item.name)}><Icon size={18} strokeWidth={1.8} /><span>{item.name}</span>{item.name === "Message approvals" && pending > 0 && <em>{pending}</em>}</button>; })}
        </nav>
        <div className="sidebar-bottom"><div className="secure-note"><ShieldCheck size={17} /><div><strong>Approval-first</strong><span>Nothing sends automatically.</span></div></div><button className="profile"><div className="profile-avatar">J</div><div><strong>{userEmail}</strong><span>Signed-in account</span></div><Settings2 size={16} /></button></div>
      </aside>

      <section className="main-panel">
        <header className="topbar"><div className="breadcrumb"><span>Johden</span><ChevronRight size={15} /><strong>{active}</strong></div><div className="top-actions"><div className={online ? "connection online" : "connection offline"}>{online ? <Cloud size={15} /> : <CloudOff size={15} />}<span>{online ? "Online" : "Offline mode"}</span></div><button className="icon-button" aria-label="Help"><CircleHelp size={18} /></button><button className="icon-button" aria-label="Notifications"><Bell size={18} /></button><form action={signOut}><button type="submit" className="sign-out-button">Sign out</button></form><div className="top-avatar">J</div></div></header>
        <div className="content">
          {notice && <div className="toast" role="status"><Check size={16} />{notice}<button onClick={() => setNotice("")} aria-label="Dismiss"><X size={14} /></button></div>}
          {active === "Overview" && <Overview prospects={prospects} pending={pending} tasks={tasks} calendarConnected={calendarConnected} calendarLoading={calendarLoading} setActive={setActive} setShowProspectForm={setShowProspectForm} setShowTaskForm={setShowTaskForm} />}
          {active === "Prospects" && <section><PageHeading eyebrow="PIPELINE" title="Prospects" subtitle="Build a qualified pipeline. Record where each lead came from and what needs to happen next." action={<button className="primary-button" onClick={() => setShowProspectForm(true)}><Plus size={17} /> Add prospect</button>} /><div className="toolbar"><div className="searchbox"><Search size={17} /><input placeholder="Search companies, contacts or industries..." value={query} onChange={(e) => setQuery(e.target.value)} /></div><span className="muted">{filteredProspects.length} records</span></div><div className="table-card"><div className="table-scroll"><table><thead><tr><th>COMPANY</th><th>INDUSTRY</th><th>STAGE</th><th>NEXT STEP</th><th>SOURCE</th></tr></thead><tbody>{filteredProspects.map((p) => <tr key={p.id}><td><strong>{p.company}</strong><small>{p.contact}</small></td><td>{p.industry}</td><td><span className="status-pill">{p.stage}</span></td><td>{p.nextStep}</td><td className="source-cell">{p.source}</td></tr>)}</tbody></table>{filteredProspects.length === 0 && <div className="empty-state">No prospects match this search.</div>}</div></div><p className="helper-line"><ShieldCheck size={15} /> Prospect examples are clearly labelled as sample data. Verify company details and contact permissions before outreach.</p></section>}
          {active === "Message approvals" && <section><PageHeading eyebrow="OUTREACH CONTROL" title="Message approvals" subtitle="Review every message before you send it. Approval here does not send a WhatsApp message." /><div className="draft-list">{drafts.map((d) => <article className="draft-card" key={d.id}><div className="draft-top"><div className="channel-icon"><MessageCircle size={19} /></div><div className="draft-meta"><strong>{d.company}</strong><span>{d.channel} · Created {d.createdAt}</span></div><span className={d.status === "Approved" ? "approved-pill" : "pending-pill"}>{d.status}</span></div><div className="message-preview">{d.message}</div><div className="draft-footer"><span><ShieldCheck size={15} /> Manual sending only</span><div className="button-row">{d.status === "Needs approval" ? <button className="primary-button small" onClick={() => approveDraft(d.id)}><Check size={15} /> Approve draft</button> : <button className="secondary-button small" onClick={() => { navigator.clipboard?.writeText(d.message); setNotice("Approved message copied. You still need to send it manually."); setTimeout(() => setNotice(""), 3500); }}><FileText size={15} /> Copy message</button>}</div></div></article>)}{drafts.length === 0 && <div className="empty-state">No message drafts yet. Drafting with AI will be enabled after the secure API setup.</div>}</div></section>}
          {active === "Tasks" && <section><PageHeading eyebrow="DAILY EXECUTION" title="Tasks" subtitle="Keep the next action visible. Changes are saved to your account and cached on this device for offline use." action={<button className="primary-button" onClick={() => setShowTaskForm(true)}><Plus size={17} /> Add task</button>} /><div className="task-list">{tasks.map((t) => <label key={t.id} className={t.done ? "task-row done" : "task-row"}><input type="checkbox" checked={t.done} onChange={(e) => setTasks((old) => old.map((item) => item.id === t.id ? { ...item, done: e.target.checked } : item))} /><span className="task-check"><Check size={13} /></span><span className="task-title">{t.title}</span><span className="task-due"><Clock3 size={14} />{formatTaskDate(t.due)}</span></label>)}</div></section>}
          {active === "Calendar" && <section><PageHeading eyebrow="SCHEDULE" title="Calendar" subtitle="See your dated tasks here and use Google Calendar for availability checks. JohdenAI will not create or change Google events." /><div className="calendar-agenda"><div className="calendar-agenda-heading"><div><h2>Upcoming tasks</h2><p>Tasks with a selected date appear here.</p></div><button className="secondary-button small" onClick={() => { setActive("Tasks"); setShowTaskForm(true); }}><Plus size={15} /> Add dated task</button></div>{tasks.filter((task) => /^\\d{4}-\\d{2}-\\d{2}$/.test(task.due)).sort((a, b) => a.due.localeCompare(b.due)).map((task) => <div className={task.done ? "calendar-agenda-row done" : "calendar-agenda-row"} key={task.id}><span className="calendar-agenda-date">{formatTaskDate(task.due)}</span><span>{task.title}</span><span className="calendar-agenda-status">{task.done ? "Completed" : "Open"}</span></div>)}{tasks.every((task) => !/^\\d{4}-\\d{2}-\\d{2}$/.test(task.due)) && <div className="empty-state">No dated tasks yet. Add a task and choose its date to see it here.</div>}</div><div className="feature-panel"><div className="feature-icon"><CalendarDays size={24} /></div><div><h3>{calendarConnected ? "Google Calendar connected" : "Connect your Google Calendar"}</h3><p>{calendarConnected ? "Your Google Calendar connection is ready for availability checks." : "Authorize read-only free/busy access. Your calendar events will not be edited."}</p><span className="feature-status"><Clock3 size={14} /> {calendarLoading ? "Checking connection…" : calendarConnected ? "Integration connected" : "Integration not connected"}</span><div className="button-row" style={{ marginTop: 16 }}>{calendarConnected ? <button className="secondary-button" onClick={disconnectCalendar} disabled={calendarLoading}>Disconnect calendar</button> : <a className="primary-button" href="/api/google/calendar/connect" aria-disabled={calendarLoading}>Connect Google Calendar</a>}</div></div></div><div className="notice-panel"><ShieldCheck size={18} /><p>Only availability information is requested. JohdenAI will not create, edit, or delete calendar events.</p></div></section>}
          {active === "Activity log" && <section><PageHeading eyebrow="ACCOUNTABILITY" title="Activity log" subtitle="Workspace records are stored securely in the account database." /><div className="feature-panel"><div className="feature-icon"><Activity size={24} /></div><div><h3>Activity tracking is being prepared</h3><p>Approval decisions, prospect changes, integration events, and future sync results will be recorded when the database is connected.</p></div></div></section>}
          {active === "Settings" && <section><PageHeading eyebrow="WORKSPACE CONTROL" title="Settings" subtitle="Configure your business identity and connected services." /><div className="settings-grid"><div className="setting-card"><div className="setting-title"><BriefcaseBusiness size={18} /><strong>Business profile</strong></div><p>Johden Business Consultancy Services</p><span className="feature-status">Basic profile · Needs verification</span></div><div className="setting-card"><div className="setting-title"><Sparkles size={18} /><strong>AI assistant</strong></div><p>Research, summarize prospects, and draft outreach for your approval.</p><span className="feature-status">Not connected</span></div><div className="setting-card"><div className="setting-title"><MessageCircle size={18} /><strong>WhatsApp Business</strong></div><p>Keep your existing number. Compatibility will be checked before connecting.</p><span className="feature-status">Not connected · No messages sent</span></div><div className="setting-card"><div className="setting-title"><Cloud size={18} /><strong>Cloud sync</strong></div><p>Your workspace is stored in Supabase and cached locally for offline access.</p><span className="feature-status">{online ? "Device online" : "Offline — local changes only"}</span></div></div></section>}
        </div>
        <footer className="footer"><span>JOHDEN AI <span className="dot">•</span> EARLY ACCESS</span><span><ShieldCheck size={14} /> Your approval is required for outreach</span></footer>
      </section>

      {showProspectForm && <div className="modal-backdrop" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) setShowProspectForm(false); }}><form className="modal" onSubmit={addProspect}><div className="modal-heading"><div><span className="eyebrow">PIPELINE</span><h2>Add prospect</h2></div><button type="button" className="icon-button" onClick={() => setShowProspectForm(false)} aria-label="Close"><X size={18} /></button></div><label>Company name<input required autoFocus value={company} onChange={(e) => setCompany(e.target.value)} placeholder="e.g. Acme Uganda Ltd" /></label><label>Contact person or public business contact<input value={contact} onChange={(e) => setContact(e.target.value)} placeholder="Name or contact to verify" /></label><label>Industry<select value={industry} onChange={(e) => setIndustry(e.target.value)}><option>Professional services</option><option>Construction</option><option>Healthcare</option><option>Education</option><option>Retail and distribution</option><option>Hospitality</option><option>Technology</option><option>Other</option></select></label><div className="modal-note"><ShieldCheck size={16} /> Verify the company and contact source before using any details for outreach.</div><div className="modal-actions"><button type="button" className="secondary-button" onClick={() => setShowProspectForm(false)}>Cancel</button><button className="primary-button" type="submit">Save prospect</button></div></form></div>}
      {showTaskForm && <div className="modal-backdrop" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) setShowTaskForm(false); }}><form className="modal" onSubmit={addTask}><div className="modal-heading"><div><span className="eyebrow">EXECUTION</span><h2>Add task</h2></div><button type="button" className="icon-button" onClick={() => setShowTaskForm(false)} aria-label="Close"><X size={18} /></button></div><label>Task<input required autoFocus value={taskText} onChange={(e) => setTaskText(e.target.value)} placeholder="What needs to happen next?" /></label><label>Due date<input required type="date" value={taskDate} min={localDateString()} onChange={(e) => setTaskDate(e.target.value)} /></label><div className="modal-note"><CloudOff size={16} /> Saved to your account when online; cached locally when offline.</div><div className="modal-actions"><button type="button" className="secondary-button" onClick={() => setShowTaskForm(false)}>Cancel</button><button className="primary-button" type="submit">Save task</button></div></form></div>}
    </main>
  );
}

function PageHeading({ eyebrow, title, subtitle, action }: { eyebrow: string; title: string; subtitle: string; action?: ReactNode }) {
  return <div className="page-heading"><div><div className="eyebrow">{eyebrow}</div><h1>{title}</h1><p>{subtitle}</p></div>{action}</div>;
}

function Overview({ prospects, pending, tasks, calendarConnected, calendarLoading, setActive, setShowProspectForm, setShowTaskForm }: { prospects: Prospect[]; pending: number; tasks: Task[]; calendarConnected: boolean; calendarLoading: boolean; setActive: (s: string) => void; setShowProspectForm: (v: boolean) => void; setShowTaskForm: (v: boolean) => void }) {
  const done = tasks.filter((t) => t.done).length;
  return <section><div className="welcome-row"><div><div className="eyebrow">TUESDAY, 10 NOVEMBER 2026</div><h1>Your business, <span>in focus.</span></h1><p>A practical workspace for finding opportunities and moving your next action forward.</p></div><div className="welcome-icon"><Sparkles size={24} /><span>AI ASSISTANT</span><small>Setup in progress</small></div></div>
    <div className="stat-grid"><Stat icon={<Target size={18} />} label="Total prospects" value={String(prospects.length)} note="Tracked in this workspace" /><Stat icon={<MessageCircle size={18} />} label="Awaiting approval" value={String(pending)} note="Messages are never auto-sent" accent /><Stat icon={<ListTodo size={18} />} label="Open tasks" value={String(tasks.length - done)} note={done + " completed"} /><Stat icon={<CalendarDays size={18} />} label="Calendar" value={calendarLoading ? "Checking…" : calendarConnected ? "Connected" : "Not linked"} note={calendarLoading ? "Checking Google Calendar" : calendarConnected ? "Google availability access ready" : "Google Calendar setup pending"} /></div>
    <div className="dashboard-grid"><div className="panel"><div className="panel-heading"><div><h2>Next actions</h2><p>Small steps that move the business forward.</p></div><button className="text-button" onClick={() => setActive("Tasks")}>View tasks <ArrowUpRight size={15} /></button></div><div className="action-list"><button className="action-row" onClick={() => setActive("Prospects")}><span className="action-icon red"><Target size={18} /></span><span><strong>Verify your first prospects</strong><small>Confirm official details and relevance</small></span><ChevronRight size={17} /></button><button className="action-row" onClick={() => setActive("Message approvals")}><span className="action-icon gold"><MessageCircle size={18} /></span><span><strong>Review outreach drafts</strong><small>{pending} message(s) waiting for your decision</small></span><ChevronRight size={17} /></button><button className="action-row" onClick={() => setActive("Calendar")}><span className="action-icon blue"><CalendarDays size={18} /></span><span><strong>Prepare calendar connection</strong><small>Appointments require your confirmation</small></span><ChevronRight size={17} /></button></div></div>
    <div className="panel"><div className="panel-heading"><div><h2>Quick capture</h2><p>Keep the next opportunity from getting lost.</p></div><Command size={19} className="muted-icon" /></div><div className="quick-actions"><button onClick={() => setShowProspectForm(true)}><span><Plus size={17} /></span><div><strong>Add a prospect</strong><small>Record a company to research</small></div></button><button onClick={() => setShowTaskForm(true)}><span><ListTodo size={17} /></span><div><strong>Create a follow-up</strong><small>Capture the next action</small></div></button><button onClick={() => setActive("Message approvals")}><span><Send size={17} /></span><div><strong>Review message drafts</strong><small>Approval before any outreach</small></div></button></div></div></div>
    <div className="bottom-note"><div className="bottom-note-icon"><ShieldCheck size={19} /></div><div><strong>Designed to assist, not act without you.</strong><p>Prospect examples are placeholders. AI research, secure cloud sync, Google Calendar, and WhatsApp integration will be enabled in stages after configuration.</p></div><button className="text-button" onClick={() => setActive("Settings")}>View setup <ChevronRight size={15} /></button></div>
  </section>;
}

function Stat({ icon, label, value, note, accent = false }: { icon: React.ReactNode; label: string; value: string; note: string; accent?: boolean }) {
  return <div className="stat-card"><div className={accent ? "stat-icon accent" : "stat-icon"}>{icon}</div><div className="stat-label">{label}</div><div className="stat-value">{value}</div><div className="stat-note">{note}</div></div>;
}
