"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";

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
    return <div className="p-8 text-white">Loading profile...</div>;
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-extrabold text-white tracking-tight drop-shadow-md">My Profile</h1>
        <p className="text-stone-400 text-sm mt-1">Manage your public profile and working hours</p>
      </div>

      {error && (
        <div className="bg-rose-500/20 border border-rose-500/50 text-rose-200 px-4 py-3 rounded-xl text-sm font-medium">
          {error}
        </div>
      )}
      
      {success && (
        <div className="bg-emerald-500/20 border border-emerald-500/50 text-emerald-200 px-4 py-3 rounded-xl text-sm font-medium">
          {success}
        </div>
      )}

      <form onSubmit={handleSubmit} className="bg-stone-900/50 border border-white/10 rounded-2xl p-6 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-xs font-bold text-stone-300 uppercase tracking-wider mb-2">Specialization</label>
            <select
              value={form.specialization}
              onChange={e => setForm({ ...form, specialization: e.target.value })}
              className="w-full bg-black/40 border border-white/10 text-white rounded-xl px-4 py-2.5 text-sm focus:border-amber-400 focus:ring-1 focus:ring-amber-400"
            >
              {SPECIALIZATIONS.map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-stone-300 uppercase tracking-wider mb-2">Slot Duration (Minutes)</label>
            <select
              value={form.slotDurationMinutes}
              onChange={e => setForm({ ...form, slotDurationMinutes: parseInt(e.target.value) })}
              className="w-full bg-black/40 border border-white/10 text-white rounded-xl px-4 py-2.5 text-sm focus:border-amber-400 focus:ring-1 focus:ring-amber-400"
            >
              <option value={15}>15 Minutes</option>
              <option value={20}>20 Minutes</option>
              <option value={30}>30 Minutes</option>
              <option value={60}>60 Minutes</option>
            </select>
          </div>
        </div>

        <div>
          <label className="block text-xs font-bold text-stone-300 uppercase tracking-wider mb-2">Public Biography</label>
          <textarea
            value={form.bio}
            onChange={e => setForm({ ...form, bio: e.target.value })}
            rows={3}
            className="w-full bg-black/40 border border-white/10 text-white rounded-xl px-4 py-2.5 text-sm focus:border-amber-400 focus:ring-1 focus:ring-amber-400"
            placeholder="Tell patients about your background and expertise..."
          />
        </div>

        <div className="pt-4 border-t border-white/10">
          <h2 className="text-lg font-bold text-white mb-4">Weekly Availability</h2>
          <div className="space-y-3">
            {DAYS.map(d => (
              <div key={d.key} className="flex items-center gap-4 bg-black/20 p-3 rounded-xl border border-white/5">
                <label className="flex items-center gap-3 w-32 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={hours[d.key]?.active || false}
                    onChange={e => setHours({
                      ...hours,
                      [d.key]: { ...hours[d.key], active: e.target.checked }
                    })}
                    className="accent-amber-400 w-4 h-4 rounded"
                  />
                  <span className="text-sm font-medium text-stone-200">{d.label}</span>
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
                      className="bg-black/40 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white focus:border-amber-400 focus:ring-1 focus:ring-amber-400"
                    />
                    <span className="text-stone-500">to</span>
                    <input
                      type="time"
                      value={hours[d.key]?.end || "17:00"}
                      onChange={e => setHours({
                        ...hours,
                        [d.key]: { ...hours[d.key], end: e.target.value }
                      })}
                      className="bg-black/40 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white focus:border-amber-400 focus:ring-1 focus:ring-amber-400"
                    />
                  </div>
                ) : (
                  <span className="text-sm text-stone-500 italic">Not available</span>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="pt-4 flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="bg-amber-400 hover:bg-amber-300 text-stone-950 font-bold py-2.5 px-6 rounded-xl text-sm transition flex items-center gap-2 shadow-lg"
          >
            {saving ? "Saving..." : "Save Profile & Availability"}
          </button>
        </div>
      </form>
    </div>
  );
}
