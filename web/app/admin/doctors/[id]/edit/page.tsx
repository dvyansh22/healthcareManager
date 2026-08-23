"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import Navbar from "@/components/Navbar";

interface DoctorProfileForm {
  name: string;
  specialization: string;
  slotDurationMinutes: number;
  bio: string;
  workingHoursJson: string;
}

export default function EditDoctorPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [form, setForm] = useState<DoctorProfileForm | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    fetchProfile();
  }, [id]);

  async function fetchProfile() {
    setLoading(true);
    try {
      const data = await apiFetch<any>(`api/admin/doctors/${id}`);
      setForm({
        name: data.name || "",
        specialization: data.specialization || "",
        slotDurationMinutes: data.slotDurationMinutes || 20,
        bio: data.bio || "",
        workingHoursJson: data.workingHoursJson || "{}",
      });
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess("");
    setSubmitting(true);
    try {
      await apiFetch(`api/admin/doctors/${id}`, {
        method: "PUT",
        body: JSON.stringify({
          specialization: form?.specialization,
          bio: form?.bio,
          workingHoursJson: form?.workingHoursJson,
          slotDurationMinutes: Number(form?.slotDurationMinutes),
        }),
      });
      setSuccess("Profile updated successfully.");
      setTimeout(() => router.push("/admin/doctors"), 1500);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#fafaf9] text-stone-900 flex flex-col">
      <Navbar />

      <main className="max-w-2xl w-full mx-auto px-6 py-12 flex-1">
        <button
          onClick={() => router.back()}
          className="text-xs font-semibold text-stone-600 hover:text-stone-900 border border-stone-300 px-3 py-1.5 rounded-lg transition mb-6"
        >
          ← Back to Roster
        </button>

        <div className="card-panel rounded-2xl p-8 space-y-6 animate-fade-in">
          <div>
            <span className="badge badge-amber mb-2">Profile Management</span>
            <h1 className="text-xl font-bold text-stone-900">
              Edit Doctor: {form?.name || "Loading..."}
            </h1>
            <p className="text-xs text-stone-600 font-medium mt-1">
              Manage clinical details, scheduling rules, and physician biography.
            </p>
          </div>

          {loading ? (
            <div className="flex justify-center py-10">
              <span className="spinner scale-150" />
            </div>
          ) : form ? (
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="grid grid-cols-2 gap-5">
                <div>
                  <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-2">
                    Specialization
                  </label>
                  <input
                    type="text"
                    value={form.specialization}
                    onChange={(e) => setForm({ ...form, specialization: e.target.value })}
                    className="w-full input-field rounded-xl px-4 py-2.5 text-sm"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-2">
                    Slot Duration (Mins)
                  </label>
                  <input
                    type="number"
                    value={form.slotDurationMinutes}
                    onChange={(e) => setForm({ ...form, slotDurationMinutes: parseInt(e.target.value) || 20 })}
                    className="w-full input-field rounded-xl px-4 py-2.5 text-sm"
                    min={5}
                    step={5}
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-2">
                  Biography
                </label>
                <textarea
                  value={form.bio}
                  onChange={(e) => setForm({ ...form, bio: e.target.value })}
                  className="w-full input-field rounded-xl px-4 py-2.5 text-sm min-h-[100px]"
                  placeholder="Enter a brief bio..."
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-2">
                  Working Hours (JSON)
                </label>
                <textarea
                  value={form.workingHoursJson}
                  onChange={(e) => setForm({ ...form, workingHoursJson: e.target.value })}
                  className="w-full input-field rounded-xl px-4 py-2.5 text-sm min-h-[100px] font-mono"
                  placeholder='{"mon":{"start":"09:00","end":"17:00"}}'
                  required
                />
              </div>

              {error && <p className="text-rose-600 text-xs font-medium">{error}</p>}
              {success && <p className="text-emerald-600 text-xs font-medium">{success}</p>}

              <button
                type="submit"
                disabled={submitting}
                className="w-full btn-primary py-2.5 rounded-xl text-sm font-semibold transition flex items-center justify-center gap-2"
              >
                {submitting && <span className="spinner" />}
                {submitting ? "Saving..." : "Save Profile Details"}
              </button>
            </form>
          ) : (
            <p className="text-rose-600 text-sm">Failed to load profile data.</p>
          )}
        </div>
      </main>
    </div>
  );
}
