"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";

export default function RegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState({ name: "", email: "", password: "", phone: "", role: "Patient" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) {
    setForm({ ...form, [e.target.name]: e.target.value });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      // Pass the role specifically in the request body based on user selection
      const data = await apiFetch<{ token: string; user: { role?: string; Role?: string } }>(
        "api/auth/register",
        { method: "POST", body: JSON.stringify({ ...form, Role: form.role }) }
      );
      localStorage.setItem("token", data.token);
      localStorage.setItem("user", JSON.stringify(data.user));
      
      const userRole = String(data.user.role ?? data.user.Role ?? form.role);
      if (userRole === "Doctor" || userRole === "1") {
        router.replace("/doctor/schedule");
      } else {
        router.replace("/doctors");
      }
    } catch (err: any) {
      setError(err.message ?? "Registration failed");
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
        {/* Header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-amber-400 border border-amber-300 text-stone-950 font-bold mb-2 shadow-xl backdrop-blur-md">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 7.5v3m0 0v3m0-3h3m-3 0h-3m-2.25-4.125a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zM4 19.235v-.11a6.375 6.375 0 0112.75 0v.109A12.318 12.318 0 0110.374 21c-2.331 0-4.512-.645-6.374-1.766z" />
            </svg>
          </div>
          <h1 className="text-2xl font-extrabold text-white tracking-tight drop-shadow-md">Create Account</h1>
          <p className="text-amber-300 text-xs mt-0.5 uppercase tracking-wider font-bold drop-shadow-sm">
            Join the HealthCore network
          </p>
        </div>

        {/* Ultra-Translucent Glass Card */}
        <div className="bg-black/35 backdrop-blur-lg border border-white/25 shadow-2xl rounded-2xl p-8 animate-fade-in">
          <form onSubmit={handleSubmit} className="space-y-4">
            {[
              { label: "Full Name", name: "name", type: "text", placeholder: "Jane Doe" },
              { label: "Email Address", name: "email", type: "email", placeholder: "jane@example.com" },
              { label: "Password", name: "password", type: "password", placeholder: "••••••••" },
              { label: "Phone Number (optional)", name: "phone", type: "tel", placeholder: "+1 (555) 000-0000" },
            ].map(({ label, name, type, placeholder }) => (
              <div key={name}>
                <label className="block text-xs font-bold text-stone-200 uppercase tracking-wider mb-1.5">
                  {label}
                </label>
                <input
                  id={`register-${name}`}
                  type={type}
                  name={name}
                  value={(form as any)[name]}
                  onChange={handleChange}
                  required={name !== "phone"}
                  className="w-full bg-black/40 border border-white/20 text-white focus:border-amber-400 focus:ring-2 focus:ring-amber-400/20 rounded-xl px-4 py-2.5 text-sm font-medium placeholder-stone-400 transition"
                  placeholder={placeholder}
                />
              </div>
            ))}

            {/* Role Selection */}
            <div>
              <label className="block text-xs font-bold text-stone-200 uppercase tracking-wider mb-2">
                I am registering as a...
              </label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 text-sm text-stone-200 cursor-pointer">
                  <input type="radio" name="role" value="Patient" checked={form.role === "Patient"} onChange={handleChange} className="accent-amber-400 w-4 h-4" />
                  Patient
                </label>
                <label className="flex items-center gap-2 text-sm text-stone-200 cursor-pointer">
                  <input type="radio" name="role" value="Doctor" checked={form.role === "Doctor"} onChange={handleChange} className="accent-amber-400 w-4 h-4" />
                  Doctor
                </label>
              </div>
            </div>

            {form.role === "Doctor" && (
              <div className="animate-fade-in">
                <label className="block text-xs font-bold text-stone-200 uppercase tracking-wider mb-1.5">
                  Specialization
                </label>
                <select
                  name="specialization"
                  value={(form as any).specialization || "General Practice"}
                  onChange={handleChange}
                  className="w-full bg-black/40 border border-white/20 text-white focus:border-amber-400 focus:ring-2 focus:ring-amber-400/20 rounded-xl px-4 py-2.5 text-sm font-medium transition"
                >
                  <option value="General Practice">General Practice</option>
                  <option value="Cardiology">Cardiology</option>
                  <option value="Dermatology">Dermatology</option>
                  <option value="Neurology">Neurology</option>
                  <option value="Pediatrics">Pediatrics</option>
                  <option value="Psychiatry">Psychiatry</option>
                  <option value="Orthopedics">Orthopedics</option>
                </select>
              </div>
            )}

            {error && (
              <div className="bg-rose-500/20 border border-rose-400/30 text-rose-200 text-xs px-3.5 py-2.5 rounded-lg font-semibold">
                {error}
              </div>
            )}

            <button
              id="register-submit"
              type="submit"
              disabled={loading}
              className="w-full bg-amber-400 hover:bg-amber-300 text-stone-950 font-extrabold py-2.5 rounded-xl text-sm transition flex items-center justify-center gap-2 mt-6 shadow-lg"
            >
              {loading && <span className="spinner" />}
              {loading ? "Registering…" : "Create Account"}
            </button>
          </form>

          <div className="mt-6 pt-6 border-t border-white/15 text-center">
            <p className="text-stone-300 text-xs font-medium">
              Already have an account?{" "}
              <Link href="/login" className="text-amber-300 hover:text-amber-200 font-bold underline transition">
                Sign in
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
