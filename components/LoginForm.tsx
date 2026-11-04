"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setBusy(true);
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
        cache: "no-store"
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "تعذر تسجيل الدخول");
      router.push(data.user.role === "COACH" ? "/dashboard" : "/subscriber");
      router.refresh();
    } catch (error) {
      setError(error instanceof Error ? error.message : "تعذر تسجيل الدخول");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="login-page">
      <form className="login-card" onSubmit={submit}>
        <div className="logo">IF</div>
        <h1>IRON FIT</h1>
        <p>منصة تدريب وإدارة المشتركين</p>
        <label>
          البريد الإلكتروني
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
            maxLength={254}
            autoComplete="username"
          />
        </label>
        <label>
          كلمة المرور
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
            minLength={8}
            maxLength={200}
            autoComplete="current-password"
          />
        </label>
        {error && <div className="error">{error}</div>}
        <button className="primary" disabled={busy}>
          {busy ? "جاري التحقق..." : "دخول"}
        </button>
        <small>حسابات المشتركين ينشئها المدرب من صفحة المشتركين.</small>
      </form>
    </main>
  );
}
