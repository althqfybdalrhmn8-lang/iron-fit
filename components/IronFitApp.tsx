"use client";

import { useCallback, useEffect, useState } from "react";
import type { SessionUser } from "@/lib/auth";

type Member = {
  id: string;
  name: string;
  weightKg: number;
  adherence: number;
  subscriptionDays: number;
  status: "ACTIVE" | "FOLLOW_UP";
  sleepHours: number;
  lastActivity: string;
  userId?: string | null;
  loginEmail?: string | null;
};

type Program = { id: string; title: string; description: string; memberId: string | null };

type Nutrition = {
  id: string; title: string; calories: number; proteinG: number; carbsG: number; fatG: number;
  notes: string; memberId: string | null;
};

type Message = { id: string; memberId?: string | null; body: string; createdAt: string };

type ProgressEntry = {
  id: string; memberId?: string; weightKg: number; sleepHours: number; adherence: number; recordedAt: string;
};

type SubscriberData = {
  member: Member; programs: Program[]; nutrition: Nutrition[]; messages: Message[]; progress: ProgressEntry[];
};

type Toast = (value: string) => void;
type Reload = () => Promise<void>;

async function api<T>(url: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(url, {
    ...options,
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    cache: "no-store"
  });
  const data = await response.json().catch(() => ({}));
  if (response.status === 401) {
    // Full reload on purpose: clears all client state after the session ends.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.href = "/login";
    throw new Error(data.error || "انتهت الجلسة");
  }
  if (!response.ok) throw new Error(data.error || "تعذر تنفيذ الطلب");
  return data as T;
}

function errorText(error: unknown) {
  return error instanceof Error ? error.message : "حدث خطأ";
}

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString("ar-SA", { dateStyle: "medium", timeStyle: "short" });
}

/** Runs an async action with a busy flag so buttons can't be double-submitted. */
function useBusy() {
  const [busy, setBusy] = useState(false);
  const run = useCallback(async (action: () => Promise<void>) => {
    setBusy(true);
    try { await action(); } finally { setBusy(false); }
  }, []);
  return [busy, run] as const;
}

const memberName = (members: Member[], id?: string | null) => members.find((m) => m.id === id)?.name;

export default function IronFitApp({ user }: { user: SessionUser }) {
  const isCoach = user.role === "COACH";
  const [page, setPage] = useState(isCoach ? "dashboard" : "home");
  const [members, setMembers] = useState<Member[]>([]);
  const [programs, setPrograms] = useState<Program[]>([]);
  const [nutrition, setNutrition] = useState<Nutrition[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [progress, setProgress] = useState<ProgressEntry[]>([]);
  const [subscriber, setSubscriber] = useState<SubscriberData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [toast, setToast] = useState("");

  const load = useCallback(async () => {
    try {
      if (isCoach) {
        const [membersData, programsData, nutritionData, messagesData, progressData] = await Promise.all([
          api<{ members: Member[] }>("/api/members"),
          api<{ programs: Program[] }>("/api/programs"),
          api<{ plans: Nutrition[] }>("/api/nutrition"),
          api<{ messages: Message[] }>("/api/messages"),
          api<{ progress: ProgressEntry[] }>("/api/progress")
        ]);
        setMembers(membersData.members);
        setPrograms(programsData.programs);
        setNutrition(nutritionData.plans);
        setMessages(messagesData.messages);
        setProgress(progressData.progress);
      } else {
        setSubscriber(await api<SubscriberData>("/api/subscriber/me"));
      }
      setError("");
    } catch (loadError) {
      setError(errorText(loadError));
    } finally {
      setLoading(false);
    }
  }, [isCoach]);

  // Initial data fetch. All state updates inside load() happen after an await, not synchronously.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(""), 2500);
    return () => window.clearTimeout(timer);
  }, [toast]);

  async function logout() {
    try {
      await api("/api/auth/logout", { method: "POST" });
    } finally {
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.location.href = "/login";
    }
  }

  if (loading) {
    return (
      <main className="login-page">
        <div className="login-card">
          <div className="logo">IF</div>
          <h1>IRON FIT</h1>
          <p>جاري التحميل...</p>
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="login-page">
        <div className="login-card">
          <h1>IRON FIT</h1>
          <div className="error">{error}</div>
          <button className="primary" onClick={() => { setError(""); setLoading(true); void load(); }}>إعادة المحاولة</button>
          <button className="btn secondary full-width" onClick={() => { void logout(); }}>تسجيل الخروج</button>
        </div>
      </main>
    );
  }

  const menu: [string, string][] = isCoach
    ? [
        ["dashboard", "الرئيسية"], ["members", "المشتركين"], ["programs", "البرامج التدريبية"],
        ["nutrition", "التغذية"], ["calculator", "حساب السعرات"], ["progress", "التقدم"],
        ["messages", "الرسائل"], ["reports", "التقارير"], ["notifications", "الإشعارات"],
        ["videos", "مقاطع التمارين"], ["settings", "الإعدادات"]
      ]
    : [["home", "الرئيسية"], ["calculator", "حساب السعرات"], ["progress", "التقدم"], ["messages", "الرسائل"]];

  return (
    <div className="app">
      <aside className={`sidebar ${menuOpen ? "open" : ""}`} aria-label="القائمة">
        <div className="brand">
          <div className="logo-sm">IF</div>
          <div><b>IRON FIT</b><small>{isCoach ? "COACH PLATFORM" : "MEMBER SPACE"}</small></div>
        </div>
        <nav>
          {menu.map(([key, label]) => (
            <button
              key={key}
              className={`nav ${page === key ? "active" : ""}`}
              aria-current={page === key ? "page" : undefined}
              onClick={() => { setPage(key); setMenuOpen(false); }}
            >
              {label}
            </button>
          ))}
        </nav>
        <div className="side-bottom">
          <button className="nav" onClick={() => { void logout(); }}>تسجيل الخروج</button>
          <div className="user-chip">
            <div className="avatar">{user.name.slice(0, 1)}</div>
            <div><b>{user.name}</b><small>{user.email}</small></div>
          </div>
        </div>
      </aside>
      {menuOpen && <div className="backdrop" onClick={() => setMenuOpen(false)} />}

      <main className="main">
        <header className="topbar">
          <button className="menu-toggle" aria-label="فتح القائمة" aria-expanded={menuOpen} onClick={() => setMenuOpen((open) => !open)}>☰</button>
          <div className="right">
            <div className="avatar">{user.name.slice(0, 1)}</div>
            <b>{user.name}</b>
          </div>
        </header>

        <section className="content">
          {isCoach && page === "dashboard" && <CoachDashboard user={user} members={members} setPage={setPage} />}
          {isCoach && page === "members" && <Members members={members} reload={load} toast={setToast} />}
          {isCoach && page === "programs" && <Programs programs={programs} members={members} reload={load} toast={setToast} />}
          {isCoach && page === "nutrition" && <NutritionPage plans={nutrition} members={members} reload={load} toast={setToast} />}
          {page === "calculator" && <Calculator toast={setToast} />}
          {page === "progress" && (isCoach
            ? <CoachProgress members={members} entries={progress} reload={load} toast={setToast} />
            : subscriber && <ProgressHistory entries={subscriber.progress} />)}
          {page === "messages" && (
            <MessagesPage
              isCoach={isCoach}
              members={members}
              messages={isCoach ? messages : subscriber?.messages || []}
              reload={load}
              toast={setToast}
            />
          )}
          {isCoach && page === "reports" && <Reports members={members} programs={programs} nutrition={nutrition} />}
          {isCoach && page === "notifications" && <Notifications members={members} />}
          {isCoach && page === "videos" && <Videos />}
          {isCoach && page === "settings" && <Settings user={user} />}
          {!isCoach && page === "home" && subscriber && <SubscriberHome data={subscriber} />}
        </section>
      </main>

      <div className={`toast ${toast ? "show" : ""}`} role="status" aria-live="polite">{toast}</div>
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <div className="empty">{children}</div>;
}

function CoachDashboard({ user, members, setPage }: { user: SessionUser; members: Member[]; setPage: (value: string) => void }) {
  const average = members.length
    ? Math.round(members.reduce((total, member) => total + member.adherence, 0) / members.length)
    : 0;
  const active = members.filter((member) => member.status === "ACTIVE").length;
  const expiring = members.filter((member) => member.subscriptionDays <= 7).length;

  return (
    <>
      <div className="hero">
        <div><h1>مرحبًا {user.name} {"👋"}</h1><div className="muted">لوحة المدرب</div></div>
      </div>
      <div className="grid4">
        <div className="card stat"><span>إجمالي المشتركين</span><b>{members.length}</b></div>
        <div className="card stat"><span>النشطون</span><b>{active}</b></div>
        <div className="card stat"><span>متوسط الالتزام</span><b>{average}%</b></div>
        <div className="card stat"><span>تنتهي خلال 7 أيام</span><b>{expiring}</b></div>
      </div>
      <div className="grid2">
        <div className="card">
          <h2>أحدث المشتركين</h2>
          <div className="list">
            {members.slice(0, 8).map((member) => (
              <div className="item" key={member.id}>
                <b>{member.name}</b>
                <small>الالتزام {member.adherence}% • متبقي {member.subscriptionDays} يوم</small>
              </div>
            ))}
            {!members.length && <Empty>لا يوجد مشتركين بعد</Empty>}
          </div>
          <div className="actions">
            <button className="btn outline" onClick={() => setPage("members")}>إدارة المشتركين</button>
          </div>
        </div>
        <div className="card">
          <h2>رسالة اليوم</h2>
          <div className="result">
            <strong>{"💪"} استمر في ثباتك</strong>
            <div className="notice">الاستمرارية أهم من الكمال.</div>
          </div>
        </div>
      </div>
    </>
  );
}

function Members({ members, reload, toast }: { members: Member[]; reload: Reload; toast: Toast }) {
  const [editing, setEditing] = useState<Member | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    name: "", weightKg: "0", adherence: "0", subscriptionDays: "30", sleepHours: "0", status: "ACTIVE",
    loginEmail: "", loginPassword: ""
  });
  const [busy, run] = useBusy();

  const set = (key: keyof typeof form) => (event: { target: { value: string } }) =>
    setForm((current) => ({ ...current, [key]: event.target.value }));

  function openForm(member?: Member) {
    setEditing(member || null);
    setForm({
      name: member?.name ?? "",
      weightKg: String(member?.weightKg ?? 0),
      adherence: String(member?.adherence ?? 0),
      subscriptionDays: String(member?.subscriptionDays ?? 30),
      sleepHours: String(member?.sleepHours ?? 0),
      status: member?.status ?? "ACTIVE",
      loginEmail: "",
      loginPassword: ""
    });
    setShowForm(true);
  }

  const save = () => run(async () => {
    try {
      const body = JSON.stringify({
        name: form.name,
        weightKg: Number(form.weightKg),
        adherence: Number(form.adherence),
        subscriptionDays: Number(form.subscriptionDays),
        sleepHours: Number(form.sleepHours),
        status: form.status,
        loginEmail: form.loginEmail,
        loginPassword: form.loginPassword
      });
      if (editing) {
        await api(`/api/members/${editing.id}`, { method: "PATCH", body });
      } else {
        await api("/api/members", { method: "POST", body });
      }
      setShowForm(false);
      setEditing(null);
      await reload();
      toast("تم الحفظ");
    } catch (error) {
      toast(errorText(error));
    }
  });

  const remove = (member: Member) => run(async () => {
    const warning = member.userId ? "\nسيتم حذف حساب الدخول الخاص به أيضًا." : "";
    if (!window.confirm(`هل تريد حذف المشترك "${member.name}"؟${warning}`)) return;
    try {
      await api(`/api/members/${member.id}`, { method: "DELETE" });
      await reload();
      toast("تم الحذف");
    } catch (error) {
      toast(errorText(error));
    }
  });

  const canAddLogin = !editing || !editing.userId;

  return (
    <div className="card">
      <div className="toolbar">
        <h2>المشتركين</h2>
        <button className="btn primary" onClick={() => openForm()}>+ إضافة</button>
      </div>

      {showForm && (
        <form className="card form-card" onSubmit={(event) => { event.preventDefault(); void save(); }}>
          <h3>{editing ? `تعديل: ${editing.name}` : "مشترك جديد"}</h3>
          <div className="form">
            <label>الاسم<input value={form.name} onChange={set("name")} maxLength={60} required minLength={2} /></label>
            <label>الوزن (كجم)<input type="number" step="0.1" min="0" max="400" value={form.weightKg} onChange={set("weightKg")} /></label>
            <label>الالتزام (%)<input type="number" min="0" max="100" value={form.adherence} onChange={set("adherence")} /></label>
            <label>أيام الاشتراك المتبقية<input type="number" min="0" max="3650" value={form.subscriptionDays} onChange={set("subscriptionDays")} /></label>
            <label>ساعات النوم<input type="number" step="0.5" min="0" max="24" value={form.sleepHours} onChange={set("sleepHours")} /></label>
            <label>الحالة
              <select value={form.status} onChange={set("status")}>
                <option value="ACTIVE">نشط</option>
                <option value="FOLLOW_UP">متابعة</option>
              </select>
            </label>
            {canAddLogin ? (
              <>
                <label>بريد دخول المشترك (اختياري)
                  <input type="email" value={form.loginEmail} onChange={set("loginEmail")} maxLength={254} autoComplete="off" />
                </label>
                <label>كلمة مرور المشترك
                  <input type="password" value={form.loginPassword} onChange={set("loginPassword")} minLength={8} maxLength={200} autoComplete="new-password" />
                </label>
                <div className="full notice">أدخل البريد وكلمة المرور إذا أردت أن يدخل المشترك ويرى برنامجه ورسائله.</div>
              </>
            ) : (
              <div className="full notice">حساب الدخول: {editing?.loginEmail}</div>
            )}
          </div>
          <div className="actions">
            <button className="btn primary" disabled={busy}>{busy ? "جاري الحفظ..." : "حفظ"}</button>
            <button type="button" className="btn secondary" onClick={() => setShowForm(false)}>إلغاء</button>
          </div>
        </form>
      )}

      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr><th>الاسم</th><th>الوزن</th><th>الالتزام</th><th>النوم</th><th>الاشتراك</th><th>الحالة</th><th>الدخول</th><th /></tr>
          </thead>
          <tbody>
            {members.map((member) => (
              <tr key={member.id}>
                <td>{member.name}</td>
                <td>{member.weightKg} كجم</td>
                <td>{member.adherence}%</td>
                <td>{member.sleepHours} س</td>
                <td>{member.subscriptionDays} يوم</td>
                <td><span className={`badge ${member.status === "ACTIVE" ? "ok" : "warn"}`}>{member.status === "ACTIVE" ? "نشط" : "متابعة"}</span></td>
                <td>{member.loginEmail || <span className="muted">—</span>}</td>
                <td>
                  <div className="actions tight">
                    <button className="btn outline" onClick={() => openForm(member)}>تعديل</button>
                    <button className="btn danger" disabled={busy} onClick={() => { void remove(member); }}>حذف</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!members.length && <Empty>لا يوجد مشتركين بعد. اضغط &quot;+ إضافة&quot; لإضافة أول مشترك.</Empty>}
      </div>
    </div>
  );
}

function Programs({ programs, members, reload, toast }: { programs: Program[]; members: Member[]; reload: Reload; toast: Toast }) {
  const [editing, setEditing] = useState<Program | null>(null);
  const [show, setShow] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [memberId, setMemberId] = useState("");
  const [busy, run] = useBusy();

  function open(program?: Program) {
    setEditing(program || null);
    setTitle(program?.title || "");
    setDescription(program?.description || "");
    setMemberId(program?.memberId || "");
    setShow(true);
  }

  const save = () => run(async () => {
    try {
      const body = JSON.stringify({ title, description, memberId: memberId || null });
      if (editing) {
        await api(`/api/programs/${editing.id}`, { method: "PATCH", body });
      } else {
        await api("/api/programs", { method: "POST", body });
      }
      setShow(false);
      setEditing(null);
      await reload();
      toast("تم الحفظ");
    } catch (error) {
      toast(errorText(error));
    }
  });

  const remove = (program: Program) => run(async () => {
    if (!window.confirm(`حذف البرنامج "${program.title}"؟`)) return;
    try {
      await api(`/api/programs/${program.id}`, { method: "DELETE" });
      await reload();
      toast("تم الحذف");
    } catch (error) {
      toast(errorText(error));
    }
  });

  return (
    <div className="card">
      <div className="toolbar">
        <h2>البرامج التدريبية</h2>
        <button className="btn primary" onClick={() => open()}>+ إضافة</button>
      </div>

      {show && (
        <form className="card form-card" onSubmit={(event) => { event.preventDefault(); void save(); }}>
          <div className="form">
            <label>البرنامج<input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} required minLength={2} /></label>
            <label>المشترك
              <select value={memberId} onChange={(e) => setMemberId(e.target.value)}>
                <option value="">عام (غير مرتبط بمشترك)</option>
                {members.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}
              </select>
            </label>
            <label className="full">الوصف
              <textarea value={description} onChange={(e) => setDescription(e.target.value)} maxLength={2000} />
            </label>
          </div>
          <div className="actions">
            <button className="btn primary" disabled={busy}>{busy ? "جاري الحفظ..." : "حفظ"}</button>
            <button type="button" className="btn secondary" onClick={() => setShow(false)}>إلغاء</button>
          </div>
        </form>
      )}

      <div className="list">
        {programs.map((program) => (
          <div className="item" key={program.id}>
            <b>{program.title}</b>
            <small className="pre">{program.description || "—"}</small>
            <small>{program.memberId ? `المشترك: ${memberName(members, program.memberId) || "—"}` : "برنامج عام"}</small>
            <div className="actions">
              <button className="btn outline" onClick={() => open(program)}>تعديل</button>
              <button className="btn danger" disabled={busy} onClick={() => { void remove(program); }}>حذف</button>
            </div>
          </div>
        ))}
        {!programs.length && <Empty>لا توجد برامج بعد</Empty>}
      </div>
    </div>
  );
}

function NutritionPage({ plans, members, reload, toast }: { plans: Nutrition[]; members: Member[]; reload: Reload; toast: Toast }) {
  const [show, setShow] = useState(false);
  const [title, setTitle] = useState("");
  const [calories, setCalories] = useState("2200");
  const [protein, setProtein] = useState("180");
  const [carbs, setCarbs] = useState("220");
  const [fat, setFat] = useState("70");
  const [notes, setNotes] = useState("");
  const [memberId, setMemberId] = useState("");
  const [busy, run] = useBusy();

  const save = () => run(async () => {
    try {
      await api("/api/nutrition", {
        method: "POST",
        body: JSON.stringify({
          title, calories: Number(calories), proteinG: Number(protein), carbsG: Number(carbs),
          fatG: Number(fat), notes, memberId: memberId || null
        })
      });
      setShow(false);
      setTitle("");
      setNotes("");
      await reload();
      toast("تم الحفظ");
    } catch (error) {
      toast(errorText(error));
    }
  });

  const remove = (plan: Nutrition) => run(async () => {
    if (!window.confirm(`حذف خطة "${plan.title}"؟`)) return;
    try {
      await api(`/api/nutrition/${plan.id}`, { method: "DELETE" });
      await reload();
      toast("تم الحذف");
    } catch (error) {
      toast(errorText(error));
    }
  });

  return (
    <div className="card">
      <div className="toolbar">
        <h2>التغذية</h2>
        <button className="btn primary" onClick={() => setShow(true)}>+ إضافة</button>
      </div>

      {show && (
        <form className="card form-card" onSubmit={(event) => { event.preventDefault(); void save(); }}>
          <div className="form">
            <label>العنوان<input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} required minLength={2} /></label>
            <label>المشترك
              <select value={memberId} onChange={(e) => setMemberId(e.target.value)}>
                <option value="">عام (غير مرتبط بمشترك)</option>
                {members.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}
              </select>
            </label>
            <label>السعرات<input type="number" min="0" max="10000" value={calories} onChange={(e) => setCalories(e.target.value)} /></label>
            <label>بروتين (غ)<input type="number" min="0" max="1000" value={protein} onChange={(e) => setProtein(e.target.value)} /></label>
            <label>كارب (غ)<input type="number" min="0" max="2000" value={carbs} onChange={(e) => setCarbs(e.target.value)} /></label>
            <label>دهون (غ)<input type="number" min="0" max="1000" value={fat} onChange={(e) => setFat(e.target.value)} /></label>
            <label className="full">ملاحظات
              <textarea value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={2000} />
            </label>
          </div>
          <div className="actions">
            <button className="btn primary" disabled={busy}>{busy ? "جاري الحفظ..." : "حفظ"}</button>
            <button type="button" className="btn secondary" onClick={() => setShow(false)}>إلغاء</button>
          </div>
        </form>
      )}

      <div className="list">
        {plans.map((plan) => (
          <div className="item" key={plan.id}>
            <b>{plan.title}</b>
            <small>{plan.calories} سعرة • بروتين {plan.proteinG}غ • كارب {plan.carbsG}غ • دهون {plan.fatG}غ</small>
            <small>{plan.memberId ? `المشترك: ${memberName(members, plan.memberId) || "—"}` : "خطة عامة"}</small>
            {plan.notes && <small className="pre">{plan.notes}</small>}
            <div className="actions">
              <button className="btn danger" disabled={busy} onClick={() => { void remove(plan); }}>حذف</button>
            </div>
          </div>
        ))}
        {!plans.length && <Empty>لا توجد خطط تغذية بعد</Empty>}
      </div>
    </div>
  );
}

type CalcResult = { calories: number; bmr: number; tdee: number; protein: number; carbs: number; fat: number };

function Calculator({ toast }: { toast: Toast }) {
  const [gender, setGender] = useState("male");
  const [age, setAge] = useState("25");
  const [weight, setWeight] = useState("80");
  const [height, setHeight] = useState("175");
  const [activity, setActivity] = useState("1.55");
  const [goal, setGoal] = useState("maintain");
  const [result, setResult] = useState<CalcResult | null>(null);
  const [busy, run] = useBusy();

  const calculate = () => run(async () => {
    try {
      const data = await api<CalcResult>("/api/calculator", {
        method: "POST",
        body: JSON.stringify({
          gender, age: Number(age), weightKg: Number(weight), heightCm: Number(height),
          activity: Number(activity), goal
        })
      });
      setResult(data);
    } catch (error) {
      toast(errorText(error));
    }
  });

  return (
    <div className="grid2">
      <form className="card" onSubmit={(event) => { event.preventDefault(); void calculate(); }}>
        <h2>حاسبة السعرات والماكروز</h2>
        <div className="form">
          <label>الجنس
            <select value={gender} onChange={(e) => setGender(e.target.value)}>
              <option value="male">ذكر</option>
              <option value="female">أنثى</option>
            </select>
          </label>
          <label>العمر<input type="number" min="14" max="100" value={age} onChange={(e) => setAge(e.target.value)} /></label>
          <label>الوزن (كجم)<input type="number" step="0.1" min="30" max="300" value={weight} onChange={(e) => setWeight(e.target.value)} /></label>
          <label>الطول (سم)<input type="number" min="120" max="230" value={height} onChange={(e) => setHeight(e.target.value)} /></label>
          <label>النشاط
            <select value={activity} onChange={(e) => setActivity(e.target.value)}>
              <option value="1.2">قليل</option>
              <option value="1.375">خفيف</option>
              <option value="1.55">متوسط</option>
              <option value="1.725">عالٍ</option>
              <option value="1.9">عالٍ جدًا</option>
            </select>
          </label>
          <label>الهدف
            <select value={goal} onChange={(e) => setGoal(e.target.value)}>
              <option value="cut">خسارة دهون</option>
              <option value="maintain">ثبات</option>
              <option value="bulk">زيادة وزن</option>
            </select>
          </label>
        </div>
        <div className="actions">
          <button className="btn primary" disabled={busy}>{busy ? "جاري الحساب..." : "احسب"}</button>
        </div>
      </form>
      <div className="card">
        {result ? (
          <>
            <h2>النتيجة</h2>
            <div className="result"><strong>{result.calories}</strong><span>سعرة / يوم</span></div>
            <div className="grid-auto">
              <div className="card stat"><span>BMR</span><b>{result.bmr}</b></div>
              <div className="card stat"><span>TDEE</span><b>{result.tdee}</b></div>
              <div className="card stat"><span>بروتين</span><b>{result.protein}غ</b></div>
              <div className="card stat"><span>كارب</span><b>{result.carbs}غ</b></div>
              <div className="card stat"><span>دهون</span><b>{result.fat}غ</b></div>
            </div>
            <div className="notice">هذه حسبة تقديرية وليست تشخيصًا طبيًا.</div>
          </>
        ) : (
          <div className="muted">أدخل البيانات ثم اضغط احسب.</div>
        )}
      </div>
    </div>
  );
}

function CoachProgress({ members, entries, reload, toast }: { members: Member[]; entries: ProgressEntry[]; reload: Reload; toast: Toast }) {
  const [memberId, setMemberId] = useState("");
  const [weight, setWeight] = useState("");
  const [sleep, setSleep] = useState("");
  const [adherence, setAdherence] = useState("");
  const [filter, setFilter] = useState("");
  const [busy, run] = useBusy();

  function selectMember(id: string) {
    setMemberId(id);
    const member = members.find((m) => m.id === id);
    if (member) {
      setWeight(String(member.weightKg));
      setSleep(String(member.sleepHours));
      setAdherence(String(member.adherence));
    }
  }

  const save = () => run(async () => {
    try {
      await api("/api/progress", {
        method: "POST",
        body: JSON.stringify({ memberId, weightKg: Number(weight), sleepHours: Number(sleep), adherence: Number(adherence) })
      });
      await reload();
      toast("تم تسجيل التقدم");
    } catch (error) {
      toast(errorText(error));
    }
  });

  const visible = filter ? entries.filter((entry) => entry.memberId === filter) : entries;

  return (
    <div className="grid2">
      <div className="card">
        <h2>تسجيل قياس جديد</h2>
        <form onSubmit={(event) => { event.preventDefault(); void save(); }}>
          <div className="form">
            <label className="full">المشترك
              <select value={memberId} onChange={(e) => selectMember(e.target.value)} required>
                <option value="">اختر</option>
                {members.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}
              </select>
            </label>
            <label>الوزن (كجم)<input type="number" step="0.1" min="0" max="400" value={weight} onChange={(e) => setWeight(e.target.value)} required /></label>
            <label>ساعات النوم<input type="number" step="0.5" min="0" max="24" value={sleep} onChange={(e) => setSleep(e.target.value)} required /></label>
            <label>الالتزام (%)<input type="number" min="0" max="100" value={adherence} onChange={(e) => setAdherence(e.target.value)} required /></label>
          </div>
          <div className="actions">
            <button className="btn primary" disabled={busy || !memberId}>{busy ? "جاري الحفظ..." : "حفظ القياس"}</button>
          </div>
        </form>
        <h3>الوضع الحالي</h3>
        <div className="list">
          {members.map((member) => (
            <div className="item" key={member.id}>
              <b>{member.name}</b>
              <small>الالتزام: {member.adherence}% • الوزن: {member.weightKg} كجم • النوم: {member.sleepHours} س</small>
            </div>
          ))}
          {!members.length && <Empty>لا يوجد مشتركين بعد</Empty>}
        </div>
      </div>
      <div className="card">
        <div className="toolbar">
          <h2>سجل القياسات</h2>
          <select className="select-sm" value={filter} onChange={(e) => setFilter(e.target.value)} aria-label="تصفية حسب المشترك">
            <option value="">كل المشتركين</option>
            {members.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}
          </select>
        </div>
        <ProgressList entries={visible} members={members} />
      </div>
    </div>
  );
}

function ProgressList({ entries, members }: { entries: ProgressEntry[]; members?: Member[] }) {
  if (!entries.length) return <Empty>لا توجد قياسات مسجلة بعد</Empty>;
  return (
    <div className="table-wrap">
      <table className="table">
        <thead>
          <tr>{members && <th>المشترك</th>}<th>التاريخ</th><th>الوزن</th><th>النوم</th><th>الالتزام</th></tr>
        </thead>
        <tbody>
          {entries.map((entry) => (
            <tr key={entry.id}>
              {members && <td>{memberName(members, entry.memberId) || "—"}</td>}
              <td>{formatDate(entry.recordedAt)}</td>
              <td>{entry.weightKg} كجم</td>
              <td>{entry.sleepHours} س</td>
              <td>{entry.adherence}%</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ProgressHistory({ entries }: { entries: ProgressEntry[] }) {
  const latest = entries[0];
  const first = entries[entries.length - 1];
  const change = latest && first && entries.length > 1 ? Math.round((latest.weightKg - first.weightKg) * 10) / 10 : null;
  return (
    <div className="card">
      <h2>تقدمك</h2>
      {change !== null && (
        <p className="muted">التغير في الوزن منذ أول قياس: <b>{change > 0 ? "+" : ""}{change} كجم</b></p>
      )}
      <ProgressList entries={entries} />
    </div>
  );
}

function MessagesPage({ isCoach, members, messages, reload, toast }: {
  isCoach: boolean; members: Member[]; messages: Message[]; reload: Reload; toast: Toast;
}) {
  const [memberId, setMemberId] = useState("");
  const [body, setBody] = useState("");
  const [busy, run] = useBusy();

  const send = () => run(async () => {
    try {
      await api("/api/messages", { method: "POST", body: JSON.stringify({ memberId, body }) });
      setBody("");
      await reload();
      toast("تم الإرسال");
    } catch (error) {
      toast(errorText(error));
    }
  });

  return (
    <div className={isCoach ? "grid2" : ""}>
      {isCoach && (
        <form className="card" onSubmit={(event) => { event.preventDefault(); void send(); }}>
          <h2>إرسال رسالة</h2>
          <div className="form">
            <label className="full">المشترك
              <select value={memberId} onChange={(e) => setMemberId(e.target.value)} required>
                <option value="">اختر</option>
                {members.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}
              </select>
            </label>
            <label className="full">الرسالة
              <textarea value={body} onChange={(e) => setBody(e.target.value)} maxLength={2000} required />
            </label>
          </div>
          <div className="actions">
            <button className="btn primary" disabled={busy || !memberId || !body.trim()}>{busy ? "جاري الإرسال..." : "إرسال"}</button>
          </div>
        </form>
      )}
      <div className="card">
        <h2>{isCoach ? "سجل الرسائل" : "رسائل مدربك"}</h2>
        <div className="list">
          {messages.map((message) => (
            <div className="item" key={message.id}>
              {isCoach && <small>إلى: {memberName(members, message.memberId) || "—"}</small>}
              <b className="pre">{message.body}</b>
              <small>{formatDate(message.createdAt)}</small>
            </div>
          ))}
          {!messages.length && <Empty>لا توجد رسائل بعد</Empty>}
        </div>
      </div>
    </div>
  );
}

function Reports({ members, programs, nutrition }: { members: Member[]; programs: Program[]; nutrition: Nutrition[] }) {
  const avg = members.length ? Math.round(members.reduce((a, m) => a + m.adherence, 0) / members.length) : 0;
  const expiring = members.filter((m) => m.subscriptionDays <= 7).length;
  const lowAdherence = members.filter((m) => m.adherence < 60).length;
  const followUp = members.filter((m) => m.status === "FOLLOW_UP").length;
  const withLogin = members.filter((m) => m.userId).length;

  return (
    <>
      <div className="hero"><div><h1>التقارير</h1><div className="muted">ملخصات وتحليلات Iron Fit</div></div></div>
      <div className="grid2">
        <div className="card">
          <h2>تقرير الالتزام</h2>
          <p className="muted">متوسط الالتزام الحالي: <b>{avg}%</b></p>
          <p className="muted">عدد البرامج: <b>{programs.length}</b> • عدد خطط التغذية: <b>{nutrition.length}</b></p>
          <p className="muted">مشتركين لديهم حساب دخول: <b>{withLogin}</b> من <b>{members.length}</b></p>
        </div>
        <div className="card">
          <h2>تنبيهات</h2>
          <div className="list">
            <div className="item"><b>اشتراكات قريبة الانتهاء</b><small>{expiring} مشترك</small></div>
            <div className="item"><b>التزام منخفض</b><small>{lowAdherence} مشترك أقل من 60%</small></div>
            <div className="item"><b>بحاجة متابعة</b><small>{followUp} مشترك</small></div>
          </div>
        </div>
      </div>
    </>
  );
}

function Notifications({ members }: { members: Member[] }) {
  const expiring = members.filter((m) => m.subscriptionDays <= 7);
  const lowAdherence = members.filter((m) => m.adherence < 60);

  return (
    <>
      <div className="hero"><div><h1>الإشعارات</h1><div className="muted">التنبيهات المهمة في مكان واحد</div></div></div>
      <div className="card">
        <div className="list">
          {expiring.map((m) => (
            <div className="item" key={`exp-${m.id}`}>
              <b>تنبيه اشتراك</b>
              <small>{m.name} — {m.subscriptionDays === 0 ? "انتهى الاشتراك" : `${m.subscriptionDays} يوم متبقي`}</small>
            </div>
          ))}
          {lowAdherence.map((m) => (
            <div className="item" key={`low-${m.id}`}>
              <b>تنبيه التزام</b>
              <small>{m.name} — {m.adherence}%</small>
            </div>
          ))}
          {!expiring.length && !lowAdherence.length && <Empty>لا توجد إشعارات حاليًا</Empty>}
        </div>
      </div>
    </>
  );
}

/** Video upload needs real object storage (S3 / R2 / disk), which this project doesn't have yet. */
function Videos() {
  return (
    <>
      <div className="hero"><div><h1>مقاطع التمارين</h1><div className="muted">ارفع مقاطع التمارين واحفظها</div></div></div>
      <div className="card">
        <div className="settings-note">
          هذه الميزة غير متاحة بعد: تحتاج مزود تخزين ملفات (مثل S3 أو R2) ومسار API للرفع.
          ستُضاف بعد اختيار مزود التخزين.
        </div>
      </div>
    </>
  );
}

function Settings({ user }: { user: SessionUser }) {
  return (
    <>
      <div className="hero"><div><h1>الإعدادات</h1><div className="muted">بيانات الحساب</div></div></div>
      <div className="card">
        <div className="form">
          <label>اسم المدرب<input value={user.name} disabled /></label>
          <label>البريد الإلكتروني<input value={user.email} disabled /></label>
        </div>
        <div className="settings-note">
          تعديل الاسم والبريد وكلمة المرور غير متاح من الواجهة بعد. لتغيير كلمة المرور حاليًا عدّل SEED_COACH_PASSWORD وشغّل npm run db:seed.
        </div>
      </div>
    </>
  );
}

function SubscriberHome({ data }: { data: SubscriberData }) {
  const member = data.member;
  return (
    <>
      <div className="hero"><div><h1>مرحبًا {member.name} {"👋"}</h1><div className="muted">آخر نشاط: {member.lastActivity || "—"}</div></div></div>
      <div className="grid4">
        <div className="card stat"><span>الالتزام</span><b>{member.adherence}%</b></div>
        <div className="card stat"><span>أيام الاشتراك المتبقية</span><b>{member.subscriptionDays}</b></div>
        <div className="card stat"><span>الوزن</span><b>{member.weightKg} كجم</b></div>
        <div className="card stat"><span>النوم</span><b>{member.sleepHours} س</b></div>
      </div>
      <div className="grid2">
        <div className="card">
          <h2>برنامجك</h2>
          <div className="list">
            {data.programs.map((program) => (
              <div className="item" key={program.id}><b>{program.title}</b><small className="pre">{program.description}</small></div>
            ))}
            {!data.programs.length && <Empty>لم يضف مدربك برنامجًا بعد</Empty>}
          </div>
        </div>
        <div className="card">
          <h2>تغذيتك</h2>
          <div className="list">
            {data.nutrition.map((plan) => (
              <div className="item" key={plan.id}>
                <b>{plan.title}</b>
                <small>{plan.calories} سعرة • بروتين {plan.proteinG}غ • كارب {plan.carbsG}غ • دهون {plan.fatG}غ</small>
                {plan.notes && <small className="pre">{plan.notes}</small>}
              </div>
            ))}
            {!data.nutrition.length && <Empty>لم يضف مدربك خطة تغذية بعد</Empty>}
          </div>
        </div>
      </div>
    </>
  );
}
