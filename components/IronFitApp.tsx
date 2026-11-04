"use client";

import { useEffect, useMemo, useState } from "react";
import type { SessionUser } from "@/lib/auth";

type Member = {
  id: string;
  name: string;
  weightKg: number;
  adherence: number;
  subscriptionDays: number;
  status: string;
  sleepHours: number;
  lastActivity: string;
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

async function api<T>(url: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(url, {
    ...options,
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    cache: "no-store"
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "Request failed");
  return data;
}

export default function IronFitApp({ user }: { user: SessionUser }) {
  const [page, setPage] = useState(user.role === "COACH" ? "dashboard" : "home");
  const [members, setMembers] = useState<Member[]>([]);
  const [programs, setPrograms] = useState<Program[]>([]);
  const [nutrition, setNutrition] = useState<Nutrition[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [subscriber, setSubscriber] = useState<SubscriberData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [toast, setToast] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      if (user.role === "COACH") {
        const [membersData, programsData, nutritionData, messagesData] = await Promise.all([
          api<{ members: Member[] }>("/api/members"),
          api<{ programs: Program[] }>("/api/programs"),
          api<{ plans: Nutrition[] }>("/api/nutrition"),
          api<{ messages: Message[] }>("/api/messages")
        ]);
        setMembers(membersData.members);
        setPrograms(programsData.programs);
        setNutrition(nutritionData.plans);
        setMessages(messagesData.messages);
      } else {
        const data = await api<SubscriberData>("/api/subscriber/me");
        setSubscriber(data);
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  function showToast(value: string) {
    setToast(value);
    window.setTimeout(() => setToast(""), 2200);
  }

  async function logout() {
    await api("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
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
          <button className="primary" onClick={() => { void load(); }}>إعادة المحاولة</button>
        </div>
      </main>
    );
  }

  const menu = user.role === "COACH"
    ? [
        ["dashboard", "الرئيسية"], ["members", "المشتركين"], ["programs", "البرامج التدريبية"],
        ["nutrition", "التغذية"], ["calculator", "حساب السعرات"], ["progress", "التقدم"],
        ["messages", "الرسائل"], ["reports", "التقارير"], ["notifications", "الإشعارات"],
        ["videos", "مقاطع التمارين"], ["settings", "الإعدادات"]
      ]
    : [["home", "الرئيسية"], ["calculator", "حساب السعرات"], ["progress", "التقدم"], ["messages", "الرسائل"]];

  return (
    <div className="app" dir="rtl">
      <aside className={`sidebar ${menuOpen ? "open" : ""}`}>
        <div className="brand">
          <div className="logo-sm">IF</div>
          <div><b>IRON FIT</b><small>{user.role === "COACH" ? "COACH PLATFORM" : "MEMBER SPACE"}</small></div>
        </div>
        <nav>
          {menu.map((item) => (
            <button
              key={item[0]}
              className={`nav ${page === item[0] ? "active" : ""}`}
              onClick={() => { setPage(item[0]); setMenuOpen(false); }}
            >
              {item[1]}
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

      <main className="main">
        <header className="topbar">
          <div className="right">
            <div className="avatar">{user.name.slice(0, 1)}</div>
            <b>{user.name}</b>
          </div>
        </header>

        <section className="content">
          {user.role === "COACH" && page === "dashboard" && <CoachDashboard members={members} setPage={setPage} />}
          {user.role === "COACH" && page === "members" && (
            <Members members={members} reload={load} toast={showToast} />
          )}
          {user.role === "COACH" && page === "programs" && (
            <Programs programs={programs} members={members} reload={load} toast={showToast} />
          )}
          {user.role === "COACH" && page === "nutrition" && (
            <NutritionPage plans={nutrition} members={members} reload={load} toast={showToast} />
          )}
          {page === "calculator" && <Calculator toast={showToast} />}
          {page === "progress" && (
            <ProgressPage user={user} members={members} subscriber={subscriber} />
          )}
          {page === "messages" && (
            <MessagesPage user={user} members={members} messages={messages} subscriber={subscriber} reload={load} toast={showToast} />
          )}
          {user.role === "COACH" && page === "reports" && <Reports members={members} programs={programs} nutrition={nutrition} />}
          {user.role === "COACH" && page === "notifications" && <Notifications members={members} />}
          {user.role === "COACH" && page === "videos" && <Videos toast={showToast} />}
          {user.role === "COACH" && page === "settings" && <Settings user={user} />}
          {user.role === "SUBSCRIBER" && page === "home" && subscriber && <SubscriberHome data={subscriber} />}
        </section>
      </main>

      <div className={`toast ${toast ? "show" : ""}`}>{toast}</div>
    </div>
  );
}

function CoachDashboard({ members, setPage }: { members: Member[]; setPage: (value: string) => void }) {
  const average = members.length
    ? Math.round(members.reduce((total, member) => total + member.adherence, 0) / members.length)
    : 0;
  const active = members.filter((member) => member.status === "ACTIVE").length;
  const expiring = members.filter((member) => member.subscriptionDays <= 7).length;

  return (
    <>
      <div className="hero">
        <div><h1>مرحبًا بك {"👋"}</h1><div className="muted">لوحة المدرب</div></div>
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
                <small>{member.adherence}% • {member.subscriptionDays} يوم</small>
              </div>
            ))}
          </div>
          <button className="btn outline" onClick={() => setPage("members")}>إدارة المشتركين</button>
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

function Members({ members, reload, toast }: { members: Member[]; reload: () => Promise<void>; toast: (value: string) => void }) {
  const [editing, setEditing] = useState<Member | null>(null);
  const [name, setName] = useState("");
  const [weight, setWeight] = useState("0");
  const [adherence, setAdherence] = useState("0");
  const [subscriptionDays, setSubscriptionDays] = useState("30");
  const [status, setStatus] = useState("ACTIVE");
  const [showForm, setShowForm] = useState(false);

  function openForm(member?: Member) {
    setEditing(member || null);
    setName(member?.name || "");
    setWeight(String(member?.weightKg || 0));
    setAdherence(String(member?.adherence || 0));
    setSubscriptionDays(String(member?.subscriptionDays || 30));
    setStatus(member?.status || "ACTIVE");
    setShowForm(true);
  }

  async function save() {
    try {
      const body = JSON.stringify({
        name, weightKg: Number(weight), adherence: Number(adherence),
        subscriptionDays: Number(subscriptionDays), status
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
      toast(error instanceof Error ? error.message : "Error");
    }
  }

  async function remove(id: string) {
    if (!window.confirm("هل تريد حذف المشترك؟")) return;
    try {
      await api(`/api/members/${id}`, { method: "DELETE" });
      await reload();
      toast("تم الحذف");
    } catch (error) {
      toast(error instanceof Error ? error.message : "Error");
    }
  }

  return (
    <div className="card">
      <div className="toolbar">
        <h2>المشتركين</h2>
        <button className="btn primary" onClick={() => openForm()}>+ إضافة</button>
      </div>

      {showForm && (
        <div className="card form-card">
          <div className="form">
            <label>الاسم<input value={name} onChange={(e) => setName(e.target.value)} maxLength={60} /></label>
            <label>الوزن<input type="number" min="0" max="400" value={weight} onChange={(e) => setWeight(e.target.value)} /></label>
            <label>الالتزام<input type="number" min="0" max="100" value={adherence} onChange={(e) => setAdherence(e.target.value)} /></label>
            <label>الاشتراك<input type="number" min="0" max="3650" value={subscriptionDays} onChange={(e) => setSubscriptionDays(e.target.value)} /></label>
            <label>الحالة
              <select value={status} onChange={(e) => setStatus(e.target.value)}>
                <option value="ACTIVE">نشط</option>
                <option value="FOLLOW_UP">متابعة</option>
              </select>
            </label>
          </div>
          <div className="actions">
            <button className="btn primary" onClick={() => { void save(); }}>حفظ</button>
            <button className="btn secondary" onClick={() => setShowForm(false)}>إلغاء</button>
          </div>
        </div>
      )}

      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr><th>الاسم</th><th>الوزن</th><th>الالتزام</th><th>الاشتراك</th><th>الحالة</th><th /></tr>
          </thead>
          <tbody>
            {members.map((member) => (
              <tr key={member.id}>
                <td>{member.name}</td>
                <td>{member.weightKg} kg</td>
                <td>{member.adherence}%</td>
                <td>{member.subscriptionDays} يوم</td>
                <td>{member.status === "ACTIVE" ? "نشط" : "متابعة"}</td>
                <td>
                  <div className="actions">
                    <button className="btn outline" onClick={() => openForm(member)}>تعديل</button>
                    <button className="btn danger" onClick={() => { void remove(member.id); }}>حذف</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Programs({
  programs, members, reload, toast
}: { programs: Program[]; members: Member[]; reload: () => Promise<void>; toast: (value: string) => void }) {
  const [editing, setEditing] = useState<Program | null>(null);
  const [show, setShow] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [memberId, setMemberId] = useState("");

  function open(program?: Program) {
    setEditing(program || null);
    setTitle(program?.title || "");
    setDescription(program?.description || "");
    setMemberId(program?.memberId || "");
    setShow(true);
  }

  async function save() {
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
      toast(error instanceof Error ? error.message : "Error");
    }
  }

  async function remove(id: string) {
    if (!window.confirm("حذف البرنامج؟")) return;
    try {
      await api(`/api/programs/${id}`, { method: "DELETE" });
      await reload();
      toast("تم الحذف");
    } catch (error) {
      toast(error instanceof Error ? error.message : "Error");
    }
  }

  return (
    <div className="card">
      <div className="toolbar">
        <h2>البرامج التدريبية</h2>
        <button className="btn primary" onClick={() => open()}>+ إضافة</button>
      </div>

      {show && (
        <div className="card form-card">
          <div className="form">
            <label>البرنامج<input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} /></label>
            <label>المشترك
              <select value={memberId} onChange={(e) => setMemberId(e.target.value)}>
                <option value="">عام</option>
                {members.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}
              </select>
            </label>
            <label className="full">الوصف
              <textarea value={description} onChange={(e) => setDescription(e.target.value)} maxLength={2000} />
            </label>
          </div>
          <div className="actions">
            <button className="btn primary" onClick={() => { void save(); }}>حفظ</button>
            <button className="btn secondary" onClick={() => setShow(false)}>إلغاء</button>
          </div>
        </div>
      )}

      <div className="list">
        {programs.map((program) => (
          <div className="item" key={program.id}>
            <b>{program.title}</b>
            <small>
              {program.description || "—"}
              {program.memberId && ` • ${members.find((m) => m.id === program.memberId)?.name || ""}`}
            </small>
            <div className="actions">
              <button className="btn outline" onClick={() => open(program)}>تعديل</button>
              <button className="btn danger" onClick={() => { void remove(program.id); }}>حذف</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function NutritionPage({
  plans, members, reload, toast
}: { plans: Nutrition[]; members: Member[]; reload: () => Promise<void>; toast: (value: string) => void }) {
  const [show, setShow] = useState(false);
  const [title, setTitle] = useState("");
  const [calories, setCalories] = useState("2200");
  const [protein, setProtein] = useState("180");
  const [carbs, setCarbs] = useState("220");
  const [fat, setFat] = useState("70");
  const [memberId, setMemberId] = useState("");

  async function save() {
    try {
      await api("/api/nutrition", {
        method: "POST",
        body: JSON.stringify({
          title, calories: Number(calories), proteinG: Number(protein), carbsG: Number(carbs),
          fatG: Number(fat), notes: "", memberId: memberId || null
        })
      });
      setShow(false);
      await reload();
      toast("تم الحفظ");
    } catch (error) {
      toast(error instanceof Error ? error.message : "Error");
    }
  }

  return (
    <div className="card">
      <div className="toolbar">
        <h2>التغذية</h2>
        <button className="btn primary" onClick={() => setShow(true)}>+ إضافة</button>
      </div>

      {show && (
        <div className="card form-card">
          <div className="form">
            <label>العنوان<input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} /></label>
            <label>المشترك
              <select value={memberId} onChange={(e) => setMemberId(e.target.value)}>
                <option value="">عام</option>
                {members.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}
              </select>
            </label>
            <label>السعرات<input type="number" min="0" max="10000" value={calories} onChange={(e) => setCalories(e.target.value)} /></label>
            <label>بروتين<input type="number" min="0" max="1000" value={protein} onChange={(e) => setProtein(e.target.value)} /></label>
            <label>كارب<input type="number" min="0" max="2000" value={carbs} onChange={(e) => setCarbs(e.target.value)} /></label>
            <label>دهون<input type="number" min="0" max="1000" value={fat} onChange={(e) => setFat(e.target.value)} /></label>
          </div>
          <div className="actions">
            <button className="btn primary" onClick={() => { void save(); }}>حفظ</button>
            <button className="btn secondary" onClick={() => setShow(false)}>إلغاء</button>
          </div>
        </div>
      )}

      <div className="list">
        {plans.map((plan) => (
          <div className="item" key={plan.id}>
            <b>{plan.title}</b>
            <small>{plan.calories} kcal • P {plan.proteinG}g • C {plan.carbsG}g • F {plan.fatG}g</small>
          </div>
        ))}
      </div>
    </div>
  );
}

function Calculator({ toast }: { toast: (value: string) => void }) {
  const [gender, setGender] = useState("male");
  const [age, setAge] = useState("25");
  const [weight, setWeight] = useState("80");
  const [height, setHeight] = useState("175");
  const [activity, setActivity] = useState("1.55");
  const [goal, setGoal] = useState("maintain");
  const [result, setResult] = useState<{ calories: number; bmr: number; tdee: number; protein: number; carbs: number; fat: number } | null>(null);

  async function calculate() {
    try {
      const data = await api<{ calories: number; bmr: number; tdee: number; protein: number; carbs: number; fat: number }>(
        "/api/calculator",
        {
          method: "POST",
          body: JSON.stringify({
            gender, age: Number(age), weightKg: Number(weight), heightCm: Number(height),
            activity: Number(activity), goal
          })
        }
      );
      setResult(data);
    } catch (error) {
      toast(error instanceof Error ? error.message : "Error");
    }
  }

  return (
    <div className="grid2">
      <div className="card">
        <h2>حاسبة السعرات والماكروز</h2>
        <div className="form">
          <label>الجنس
            <select value={gender} onChange={(e) => setGender(e.target.value)}>
              <option value="male">ذكر</option>
              <option value="female">أنثى</option>
            </select>
          </label>
          <label>العمر<input type="number" min="14" max="100" value={age} onChange={(e) => setAge(e.target.value)} /></label>
          <label>الوزن<input type="number" min="30" max="300" value={weight} onChange={(e) => setWeight(e.target.value)} /></label>
          <label>الطول<input type="number" min="120" max="230" value={height} onChange={(e) => setHeight(e.target.value)} /></label>
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
        <button className="btn primary" onClick={() => { void calculate(); }}>احسب</button>
      </div>
      <div className="card">
        {result ? (
          <>
            <h2>النتيجة</h2>
            <div className="result"><strong>{result.calories}</strong><span>kcal/day</span></div>
            <div className="grid4">
              <div className="card stat"><span>BMR</span><b>{result.bmr}</b></div>
              <div className="card stat"><span>TDEE</span><b>{result.tdee}</b></div>
              <div className="card stat"><span>Protein</span><b>{result.protein}g</b></div>
              <div className="card stat"><span>Carbs</span><b>{result.carbs}g</b></div>
              <div className="card stat"><span>Fat</span><b>{result.fat}g</b></div>
            </div>
            <div className="notice">هذه حسبة تقديرية وليست تشخيصًا طبيًا.</div>
          </>
        ) : (
          <div className="muted">أدخل بياناتك ثم اضغط احسب.</div>
        )}
      </div>
    </div>
  );
}

function ProgressPage({
  user, members, subscriber
}: { user: SessionUser; members: Member[]; subscriber: SubscriberData | null }) {
  const list = user.role === "COACH" ? members : subscriber ? [subscriber.member] : [];
  return (
    <div className="grid2">
      <div className="card">
        <h2>التقدم</h2>
        <div className="list">
          {list.map((member) => (
            <div className="item" key={member.id}>
              <b>{member.name}</b>
              <small>الالتزام: {member.adherence}% • الوزن: {member.weightKg}kg • النوم: {member.sleepHours}h</small>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function MessagesPage({
  user, members, messages, subscriber, reload, toast
}: {
  user: SessionUser; members: Member[]; messages: Message[]; subscriber: SubscriberData | null;
  reload: () => Promise<void>; toast: (value: string) => void;
}) {
  const [memberId, setMemberId] = useState("");
  const [body, setBody] = useState("");

  async function send() {
    try {
      await api("/api/messages", { method: "POST", body: JSON.stringify({ memberId, body }) });
      setBody("");
      await reload();
      toast("تم الإرسال");
    } catch (error) {
      toast(error instanceof Error ? error.message : "Error");
    }
  }

  const list = user.role === "COACH" ? messages : subscriber?.messages || [];

  return (
    <div className="grid2">
      {user.role === "COACH" && (
        <div className="card">
          <h2>إرسال رسالة</h2>
          <div className="form">
            <label>المشترك
              <select value={memberId} onChange={(e) => setMemberId(e.target.value)}>
                <option value="">اختر</option>
                {members.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}
              </select>
            </label>
            <label className="full">الرسالة
              <textarea value={body} onChange={(e) => setBody(e.target.value)} maxLength={2000} />
            </label>
          </div>
          <button className="btn primary" onClick={() => { void send(); }}>إرسال</button>
        </div>
      )}
      <div className="card">
        <h2>سجل الرسائل</h2>
        <div className="list">
          {list.map((message) => (
            <div className="item" key={message.id}>
              <b>{message.body}</b>
              <small>{new Date(message.createdAt).toLocaleString("ar-SA")}</small>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ===== New pages, derived entirely from data already fetched via the secure API — no new endpoints needed ===== */

function Reports({ members, programs, nutrition }: { members: Member[]; programs: Program[]; nutrition: Nutrition[] }) {
  const avg = members.length ? Math.round(members.reduce((a, m) => a + m.adherence, 0) / members.length) : 0;
  const expiring = members.filter((m) => m.subscriptionDays <= 7).length;
  const lowAdherence = members.filter((m) => m.adherence < 60).length;

  return (
    <>
      <div className="hero"><div><h1>التقارير</h1><div className="muted">ملخصات وتحليلات Iron Fit</div></div></div>
      <div className="grid2">
        <div className="card">
          <h2>تقرير الالتزام</h2>
          <p className="muted">متوسط الالتزام الحالي: <b>{avg}%</b></p>
          <p className="muted">عدد البرامج: <b>{programs.length}</b> • عدد خطط التغذية: <b>{nutrition.length}</b></p>
        </div>
        <div className="card">
          <h2>تنبيهات</h2>
          <div className="list">
            <div className="item"><b>اشتراكات قريبة الانتهاء</b><small>{expiring} مشترك</small></div>
            <div className="item"><b>التزام منخفض</b><small>{lowAdherence} مشترك أقل من 60%</small></div>
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
              <small>{m.name} — {m.subscriptionDays} يوم متبقي</small>
            </div>
          ))}
          {lowAdherence.map((m) => (
            <div className="item" key={`low-${m.id}`}>
              <b>تنبيه التزام</b>
              <small>{m.name} — {m.adherence}%</small>
            </div>
          ))}
          {!expiring.length && !lowAdherence.length && <div className="empty muted">لا توجد إشعارات حاليًا</div>}
        </div>
      </div>
    </>
  );
}

/**
 * Video storage is intentionally NOT wired to fake/local behavior.
 * The Postgres schema in db/schema.sql has no blob storage, and no object-storage
 * (S3 / R2 / disk) is configured in this project. Rather than fake it with
 * client-side storage again, this page calls the real API and surfaces
 * the real result — which is "not built yet" until that infra exists.
 */
function Videos({ toast }: { toast: (value: string) => void }) {
  const [status, setStatus] = useState<"checking" | "unavailable">("checking");

  useEffect(() => {
    let cancelled = false;
    fetch("/api/videos", { cache: "no-store" })
      .then((response) => {
        if (!cancelled && response.status === 404) setStatus("unavailable");
      })
      .catch(() => { if (!cancelled) setStatus("unavailable"); });
    return () => { cancelled = true; };
  }, []);

  return (
    <>
      <div className="hero"><div><h1>مقاطع التمارين</h1><div className="muted">ارفع مقاطع التمارين واحفظها</div></div></div>
      <div className="card">
        {status === "checking" && <div className="muted">جاري التحقق...</div>}
        {status === "unavailable" && (
          <div className="settings-note">
            هذه الميزة تحتاج تخزين ملفات حقيقي (S3 / R2 / قرص + بروكسي) غير موجود بعد في هذا المشروع.
            جدول قاعدة البيانات الحالي (db/schema.sql) لا يحتوي على عمود لتخزين الفيديو، لذلك لا يوجد API
            حقيقي بعد لرفع المقاطع. يمكن إضافته لاحقًا كخطوة منفصلة بعد اختيار مزود التخزين.
          </div>
        )}
      </div>
    </>
  );
}

function Settings({ user }: { user: SessionUser }) {
  return (
    <>
      <div className="hero"><div><h1>الإعدادات</h1><div className="muted">تخصيص الحساب</div></div></div>
      <div className="card">
        <div className="form">
          <label>اسم المدرب<input value={user.name} disabled /></label>
          <label>البريد الإلكتروني<input value={user.email} disabled /></label>
        </div>
        <div className="settings-note">
          تعديل هذه الحقول يتطلب إضافة مسار API خاص (PATCH /api/auth/me) — غير موجود بعد، لذلك الحقول للعرض فقط حاليًا.
        </div>
      </div>
    </>
  );
}

function SubscriberHome({ data }: { data: SubscriberData }) {
  const member = data.member;
  return (
    <>
      <div className="grid4">
        <div className="card stat"><span>الالتزام</span><b>{member.adherence}%</b></div>
        <div className="card stat"><span>الاشتراك</span><b>{member.subscriptionDays}</b></div>
        <div className="card stat"><span>الوزن</span><b>{member.weightKg}</b></div>
        <div className="card stat"><span>النوم</span><b>{member.sleepHours}h</b></div>
      </div>
      <div className="grid2">
        <div className="card">
          <h2>برنامجك</h2>
          <div className="list">
            {data.programs.map((program) => (
              <div className="item" key={program.id}><b>{program.title}</b><small>{program.description}</small></div>
            ))}
          </div>
        </div>
        <div className="card">
          <h2>تغذيتك</h2>
          <div className="list">
            {data.nutrition.map((plan) => (
              <div className="item" key={plan.id}>
                <b>{plan.title}</b>
                <small>{plan.calories} kcal • P {plan.proteinG}g • C {plan.carbsG}g • F {plan.fatG}g</small>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
