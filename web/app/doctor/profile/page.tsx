"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import Navbar from "@/components/Navbar";

const DAYS = [
  { key: "mon", label: "Monday" },
  { key: "tue", label: "Tuesday" },
  { key: "wed", label: "Wednesday" },
  { key: "thu", label: "Thursday" },
  { key: "fri", label: "Friday" },
  { key: "sat", label: "Saturday" },
  { key: "sun", label: "Sunday" },
];

const SPECIALIZATIONS = [
  "General Practice",
  "Cardiology",
  "Dermatology",
  "Neurology",
  "Pediatrics",
  "Psychiatry",
  "Orthopedics"
];

export default function DoctorProfilePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [form, setForm] = useState({
    specialization: "",
    bio: "",
    slotDurationMinutes: 15,
  });

  const [hours, setHours] = useState<Record<string, { active: boolean; start: string; end: string }>>({});

  useEffect(() => {
    fetchProfile();
  }, []);

  async function fetchProfile() {
    try {
      const data = await apiFetch<any>(`api/doctors/me`);
      setForm({
        specialization: data.specialization || "General Practice",
        bio: data.bio || "",
        slotDurationMinutes: data.slotDurationMinutes || 15,
      });

      const parsedHours = data.workingHoursJson ? JSON.parse(data.workingHoursJson) : {};
      const newHours: any = {};
      
      DAYS.forEach(d => {
        if (parsedHours[d.key]) {
          newHours[d.key] = { active: true, start: parsedHours[d.key].start, end: parsedHours[d.key].end };
        } else {
          newHours[d.key] = { active: false, start: "09:00", end: "17:00" };
        }
      });
      setHours(newHours);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    setSuccess("");

    const workingHoursJson: any = {};
    DAYS.forEach(d => {
      if (hours[d.key]?.active) {
        workingHoursJson[d.key] = {
          start: hours[d.key].start,
          end: hours[d.key].end
        };
      }
    });

    try {
      await apiFetch(`api/doctors/me`, {
        method: "PUT",
        body: JSON.stringify({
          ...form,
          workingHoursJson: JSON.stringify(workingHoursJson)
        })
      });
      setSuccess("Profile and availability updated successfully.");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#fafaf9] text-stone-900 flex flex-col">
        <Navbar />
        <div className="flex justify-center py-20">
          <span className="spinner scale-150 border-amber-400" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#fafaf9] text-stone-900 flex flex-col">
      <Navbar />

      <main className="max-w-4xl w-full mx-auto px-6 py-10 flex-1">
        <div className="mb-8 border-b border-stone-200 pb-6">
          <h1 className="text-2xl font-bold tracking-tight text-stone-900">My Profile</h1>
          <p className="text-stone-600 text-sm mt-1">Manage your public profile and working hours</p>
        </div>

        {error && (
          <div className="mb-6 bg-rose-50 border border-rose-200 text-rose-700 px-4 py-3 rounded-xl text-sm font-medium">
            {error}
          </div>
        )}
        
        {success && (
          <div className="mb-6 bg-emerald-50 border border-emerald-200 text-emerald-700 px-4 py-3 rounded-xl text-sm font-medium">
            {success}
          </div>
        )}

        <form onSubmit={handleSubmit} className="card-panel rounded-2xl p-6 sm:p-8 space-y-8 bg-white border border-stone-200 shadow-sm">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div>
              <label className="block text-xs font-bold text-stone-500 uppercase tracking-wider mb-2">Specialization</label>
              <select
                value={form.specialization}
                onChange={e => setForm({ ...form, specialization: e.target.value })}
                className="w-full bg-stone-50 border border-stone-200 text-stone-900 rounded-xl px-4 py-2.5 text-sm focus:border-amber-400 focus:ring-2 focus:ring-amber-400/20 transition shadow-sm"
              >
                {SPECIALIZATIONS.map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-stone-500 uppercase tracking-wider mb-2">Slot Duration (Minutes)</label>
              <select
                value={form.slotDurationMinutes}
                onChange={e => setForm({ ...form, slotDurationMinutes: parseInt(e.target.value) })}
                className="w-full bg-stone-50 border border-stone-200 text-stone-900 rounded-xl px-4 py-2.5 text-sm focus:border-amber-400 focus:ring-2 focus:ring-amber-400/20 transition shadow-sm"
              >
                <option value={15}>15 Minutes</option>
                <option value={20}>20 Minutes</option>
                <option value={30}>30 Minutes</option>
                <option value={60}>60 Minutes</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-stone-500 uppercase tracking-wider mb-2">Public Biography</label>
            <textarea
              value={form.bio}
              onChange={e => setForm({ ...form, bio: e.target.value })}
              rows={3}
              className="w-full bg-stone-50 border border-stone-200 text-stone-900 rounded-xl px-4 py-3 text-sm focus:border-amber-400 focus:ring-2 focus:ring-amber-400/20 transition shadow-sm placeholder:text-stone-400"
              placeholder="Tell patients about your background and expertise..."
            />
          </div>

          <div className="pt-6 border-t border-stone-100">
            <h2 className="text-lg font-bold text-stone-900 mb-4">Weekly Availability</h2>
            <div className="space-y-3">
              {DAYS.map(d => (
                <div key={d.key} className="flex items-center gap-4 bg-stone-50 p-4 rounded-xl border border-stone-200/60 shadow-xs transition hover:border-stone-300">
                  <label className="flex items-center gap-3 w-32 cursor-pointer group">
                    <div className="relative flex items-center justify-center">
                      <input
                        type="checkbox"
                        checked={hours[d.key]?.active || false}
                        onChange={e => setHours({
                          ...hours,
                          [d.key]: { ...hours[d.key], active: e.target.checked }
                        })}
                        className="peer appearance-none w-5 h-5 border-2 border-stone-300 rounded cursor-pointer checked:bg-amber-400 checked:border-amber-400 transition"
                      />
                      <svg className="absolute w-3.5 h-3.5 text-stone-950 opacity-0 peer-checked:opacity-100 pointer-events-none" viewBox="0 0 14 10" fill="none">
                        <path d="M1 5L4.5 8.5L13 1" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </div>
                    <span className="text-sm font-semibold text-stone-700 group-hover:text-stone-900 transition">{d.label}</span>
                  </label>
                  
                  {hours[d.key]?.active ? (
                    <div className="flex items-center gap-2">
                      <input
                        type="time"
                        value={hours[d.key]?.start || "09:00"}
                        onChange={e => setHours({
                          ...hours,
                          [d.key]: { ...hours[d.key], start: e.target.value }
                        })}
                        className="bg-white border border-stone-200 rounded-lg px-3 py-1.5 text-sm text-stone-900 font-medium focus:border-amber-400 focus:ring-2 focus:ring-amber-400/20 transition shadow-sm"
                      />
                      <span className="text-stone-400 font-medium px-1">to</span>
                      <input
                        type="time"
                        value={hours[d.key]?.end || "17:00"}
                        onChange={e => setHours({
                          ...hours,
                          [d.key]: { ...hours[d.key], end: e.target.value }
                        })}
                        className="bg-white border border-stone-200 rounded-lg px-3 py-1.5 text-sm text-stone-900 font-medium focus:border-amber-400 focus:ring-2 focus:ring-amber-400/20 transition shadow-sm"
                      />
                    </div>
                  ) : (
                    <span className="text-sm text-stone-400 italic font-medium">Not available</span>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="pt-6 mt-4 flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="bg-stone-900 hover:bg-stone-800 text-white font-bold py-2.5 px-6 rounded-xl text-sm transition flex items-center gap-2 shadow-md active:scale-[0.98]"
            >
              {saving ? "Saving..." : "Save Profile & Availability"}
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}
