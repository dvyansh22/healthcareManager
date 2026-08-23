"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/api";
import Navbar from "@/components/Navbar";

interface DoctorProfile {
  id: string;
  userId: string;
  name: string;
  email: string;
  specialization: string;
  bio?: string;
  workingHoursJson: string;
  slotDurationMinutes: number;
}

interface CreateUserForm {
  email: string;
  password: string;
  name: string;
  phone: string;
  role: string;
}

export default function AdminDoctorsPage() {
  const [doctors, setDoctors] = useState<DoctorProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState<CreateUserForm>({
    email: "", password: "", name: "", phone: "", role: "Doctor"
  });
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => { fetchDoctors(); }, []);

  async function fetchDoctors() {
    setLoading(true);
    try {
      const data = await apiFetch<DoctorProfile[]>("api/admin/doctors");
      setDoctors(data);
    } finally {
      setLoading(false);
    }
  }

  async function createUser(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setCreating(true);
    try {
      await apiFetch("api/admin/users", { method: "POST", body: JSON.stringify(form) });
      setSuccess("Account created successfully.");
      setShowCreate(false);
      setForm({ email: "", password: "", name: "", phone: "", role: "Doctor" });
      fetchDoctors();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#fafaf9] text-stone-900 flex flex-col">
      <Navbar />

      <main className="max-w-5xl w-full mx-auto px-6 py-10 flex-1">
        <div className="mb-8 border-b border-stone-200 pb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-stone-900">Physician Roster & Operations</h1>
            <p className="text-stone-600 text-sm mt-1">Manage doctor profiles, user accounts, and schedule leaves</p>
          </div>
          <button
            id="create-user-btn"
            onClick={() => setShowCreate(!showCreate)}
            className="btn-primary px-4 py-2 rounded-xl text-xs font-semibold transition"
          >
            {showCreate ? "Cancel" : "+ Provision New User"}
          </button>
        </div>

        {success && (
          <div className="bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs px-4 py-3 rounded-xl mb-6 font-medium">
            {success}
          </div>
        )}

        {/* Form: Create User */}
        {showCreate && (
          <form onSubmit={createUser} className="card-panel rounded-2xl p-6 mb-8 space-y-4 animate-fade-in">
            <h2 className="text-xs font-bold uppercase tracking-wider text-amber-800">Provision User Account</h2>

            <div className="grid grid-cols-2 gap-4">
              {[
                { label: "Full Name", name: "name", type: "text" },
                { label: "Email Address", name: "email", type: "email" },
                { label: "Password", name: "password", type: "password" },
                { label: "Phone", name: "phone", type: "tel" },
              ].map(({ label, name, type }) => (
                <div key={name}>
                  <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1">
                    {label}
                  </label>
                  <input
                    id={`create-${name}`}
                    type={type}
                    value={(form as any)[name]}
                    onChange={(e) => setForm({ ...form, [name]: e.target.value })}
                    required={name !== "phone"}
                    className="w-full input-field rounded-xl px-3.5 py-2 text-xs"
                  />
                </div>
              ))}
              <div>
                <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1">Role</label>
                <select
                  id="create-role"
                  value={form.role}
                  onChange={(e) => setForm({ ...form, role: e.target.value })}
                  className="w-full input-field rounded-xl px-3.5 py-2 text-xs"
                >
                  <option value="Doctor">Doctor</option>
                  <option value="Admin">Admin</option>
                </select>
              </div>
            </div>

            {error && <p className="text-rose-600 text-xs font-medium">{error}</p>}

            <button
              type="submit"
              disabled={creating}
              className="btn-primary px-5 py-2 rounded-xl text-xs font-semibold transition flex items-center gap-2"
            >
              {creating && <span className="spinner" />}
              {creating ? "Creating…" : "Save Account"}
            </button>
          </form>
        )}

        {loading && (
          <div className="flex justify-center py-20">
            <span className="spinner scale-150" />
          </div>
        )}

        <div className="space-y-3">
          {doctors.map((d) => (
            <div key={d.id} id={`admin-doctor-${d.id}`} className="card-panel rounded-2xl p-5 flex items-center justify-between animate-fade-in">
              <div className="flex items-center gap-4">
                <div className="w-11 h-11 rounded-xl bg-amber-100 border border-amber-300 flex items-center justify-center text-amber-900 font-bold text-sm shadow-2xs">
                  🩺
                </div>
                <div>
                  <p className="font-bold text-stone-900 text-sm">Dr. {d.name}</p>
                  <p className="text-amber-800 text-xs font-bold">{d.specialization || "No specialty set"}</p>
                  <p className="text-stone-500 text-xs font-mono font-medium mt-0.5">{d.email} · {d.slotDurationMinutes}m slots</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Link
                  href={`/admin/doctors/${d.id}/edit`}
                  className="btn-secondary px-3.5 py-1.5 rounded-lg text-xs font-semibold transition flex items-center gap-1.5"
                >
                  <span>⚙️ Edit Profile</span>
                </Link>
                <Link
                  href={`/admin/doctors/${d.id}/leave`}
                  id={`mark-leave-${d.id}`}
                  className="btn-secondary px-3.5 py-1.5 rounded-lg text-xs font-semibold transition flex items-center gap-1.5"
                >
                  <span>🌴 Mark Leave</span>
                </Link>
              </div>
            </div>
          ))}

          {!loading && doctors.length === 0 && (
            <div className="card-panel rounded-2xl p-12 text-center">
              <p className="text-stone-500 text-sm">No doctor profiles found.</p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
