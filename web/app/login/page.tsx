"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { apiFetch, getRole } from "@/lib/api";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const data = await apiFetch<{ token: string; user: { role?: string; Role?: string } }>(
        "api/auth/login",
        {
          method: "POST",
          body: JSON.stringify({ email, password }),
        }
      );
      localStorage.setItem("token", data.token);
      localStorage.setItem("user", JSON.stringify(data.user));

      const role = String(getRole() ?? data.user.role ?? data.user.Role ?? "");
      if (role === "Doctor" || role === "1") router.replace("/doctor/schedule");
      else if (role === "Admin" || role === "2") router.replace("/admin/doctors");
      else router.replace("/doctors");
    } catch (err: any) {
      setError(err.message ?? "Authentication failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative min-h-screen flex flex-col justify-center items-center px-4 py-12 bg-stone-950 overflow-hidden">
      {/* Background Landscape Video */}
      <video
        autoPlay
        loop
        muted
        playsInline
        className="absolute inset-0 w-full h-full object-cover z-0 scale-105"
      >
        <source src="/bg-video.mp4" type="video/mp4" />
      </video>

      {/* Crystal Clear Light Overlay */}
      <div className="absolute inset-0 bg-black/20 backdrop-blur-[1px] z-0" />

      {/* Foreground Content */}
      <div className="relative z-10 w-full max-w-md">
        {/* Brand Header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-amber-400 border border-amber-300 text-stone-950 font-bold mb-2 shadow-xl backdrop-blur-md">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
          </div>
          <h1 className="text-2xl font-extrabold text-white tracking-tight drop-shadow-md">HealthCore</h1>
          <p className="text-amber-300 text-xs mt-0.5 uppercase tracking-wider font-bold drop-shadow-sm">
            Clinical Appointment Portal
          </p>
        </div>

        {/* Ultra-Translucent Glass Card */}
        <div className="bg-black/35 backdrop-blur-lg border border-white/25 shadow-2xl rounded-2xl p-8 animate-fade-in">
          <h2 className="text-lg font-bold text-white mb-6">Sign in to your account</h2>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-xs font-bold text-stone-200 uppercase tracking-wider mb-2">
                Email Address
              </label>
              <input
                id="login-email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-black/40 border border-white/20 text-white focus:border-amber-400 focus:ring-2 focus:ring-amber-400/20 rounded-xl px-4 py-2.5 text-sm font-medium placeholder-stone-400 transition"
                placeholder="name@clinic.com"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-stone-200 uppercase tracking-wider mb-2">
                Password
              </label>
              <input
                id="login-password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-black/40 border border-white/20 text-white focus:border-amber-400 focus:ring-2 focus:ring-amber-400/20 rounded-xl px-4 py-2.5 text-sm font-medium placeholder-stone-400 transition"
                placeholder="••••••••"
              />
            </div>

            {error && (
              <div className="bg-rose-500/20 border border-rose-400/30 text-rose-200 text-xs px-3.5 py-2.5 rounded-lg flex items-center gap-2 font-semibold">
                <svg className="w-4 h-4 shrink-0 text-rose-300" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                </svg>
                <span>{error}</span>
              </div>
            )}

            <button
              id="login-submit"
              type="submit"
              disabled={loading}
              className="w-full bg-amber-400 hover:bg-amber-300 text-stone-950 font-extrabold py-2.5 rounded-xl text-sm transition flex items-center justify-center gap-2 shadow-lg"
            >
              {loading && <span className="spinner" />}
              {loading ? "Authenticating…" : "Sign In"}
            </button>
          </form>

          <div className="mt-6 pt-6 border-t border-white/15 text-center">
            <p className="text-stone-300 text-xs font-medium">
              New patient?{" "}
              <Link href="/register" className="text-amber-300 hover:text-amber-200 font-bold underline transition">
                Create an account
              </Link>
            </p>
          </div>
        </div>

        {/* Demo Credentials Footer Container */}
        <div className="mt-6 bg-black/40 backdrop-blur-md border border-white/20 text-stone-200 rounded-xl p-3 text-center text-xs space-y-1 shadow-lg">
          <p className="font-bold uppercase tracking-wider text-[10px] text-amber-400">Demo Quick-Access Credentials</p>
          <p>Doctor: <code className="bg-white/20 text-white px-1.5 py-0.5 rounded font-mono">doctor@example.com</code> / <code className="bg-white/20 text-white px-1.5 py-0.5 rounded font-mono">Doctor123!</code></p>
          <p>Admin: <code className="bg-white/20 text-white px-1.5 py-0.5 rounded font-mono">admin@example.com</code> / <code className="bg-white/20 text-white px-1.5 py-0.5 rounded font-mono">Admin123!</code></p>
        </div>
      </div>
    </div>
  );
}
