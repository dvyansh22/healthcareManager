"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/api";
import Navbar from "@/components/Navbar";

interface Doctor {
  id: string;
  name: string;
  email: string;
  specialization: string;
  bio?: string;
  slotDurationMinutes: number;
}

export default function DoctorsPage() {
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function fetchDoctors(spec?: string) {
    setLoading(true);
    try {
      const qs = spec ? `?specialization=${encodeURIComponent(spec)}` : "";
      const data = await apiFetch<Doctor[]>(`api/doctors${qs}`);
      setDoctors(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchDoctors(); }, []);

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    fetchDoctors(search);
  }

  return (
    <div className="min-h-screen bg-[#fafaf9] text-stone-900 flex flex-col">
      <Navbar />

      <main className="max-w-6xl w-full mx-auto px-6 py-10 flex-1">
        {/* Page Title */}
        <div className="mb-8 border-b border-stone-200 pb-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-stone-900">Find & Book a Physician</h1>
            <p className="text-stone-600 text-sm mt-1">Select a doctor to view availability and schedule your visit</p>
          </div>
          <div className="flex items-center gap-2">
            {["Cardiology", "General", "Pediatrics"].map((spec) => (
              <button
                key={spec}
                onClick={() => { setSearch(spec); fetchDoctors(spec); }}
                className="text-xs bg-white border border-stone-300 hover:border-amber-500 hover:bg-amber-50 text-stone-800 font-medium px-3 py-1.5 rounded-lg transition shadow-2xs"
              >
                {spec}
              </button>
            ))}
          </div>
        </div>

        {/* Search Bar */}
        <form onSubmit={handleSearch} className="flex gap-3 mb-8">
          <div className="relative flex-1">
            <svg className="w-4 h-4 text-stone-400 absolute left-4 top-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
            </svg>
            <input
              id="doctor-search"
              type="text"
              placeholder="Search by specialty or doctor name…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full input-field rounded-xl pl-11 pr-4 py-2.5 text-sm"
            />
          </div>
          <button type="submit" className="btn-primary px-6 py-2.5 rounded-xl text-sm font-semibold transition">
            Search
          </button>
        </form>

        {loading && (
          <div className="flex justify-center py-20">
            <span className="spinner scale-150" />
          </div>
        )}

        {error && (
          <div className="bg-rose-50 border border-rose-200 text-rose-800 text-sm p-4 rounded-xl mb-6 font-medium">
            {error}
          </div>
        )}

        {/* Doctor Grid */}
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {doctors.map((d) => (
            <Link
              key={d.id}
              href={`/doctors/${d.id}`}
              id={`doctor-card-${d.id}`}
              className="card-interactive rounded-2xl p-6 flex flex-col justify-between group"
            >
              <div>
                <div className="flex items-start justify-between mb-4">
                  <div className="w-12 h-12 rounded-xl bg-amber-100 border border-amber-300 flex items-center justify-center text-amber-900 font-bold text-lg">
                    {d.name.split(" ").map(n => n[0]).slice(-2).join("")}
                  </div>
                  <span className="badge badge-yellow">{d.specialization}</span>
                </div>

                <h2 className="font-bold text-stone-900 text-lg group-hover:text-amber-800 transition">
                  Dr. {d.name}
                </h2>
                <p className="text-xs text-stone-500 font-medium mt-0.5">{d.email}</p>

                {d.bio && (
                  <p className="text-stone-600 text-xs mt-3 line-clamp-2 leading-relaxed">
                    {d.bio}
                  </p>
                )}
              </div>

              <div className="mt-6 pt-4 border-t border-stone-200 flex items-center justify-between">
                <span className="text-xs text-stone-500 font-semibold">
                  {d.slotDurationMinutes} min consultations
                </span>
                <span className="text-xs text-amber-800 font-bold group-hover:translate-x-0.5 transition flex items-center gap-1">
                  Book Slot →
                </span>
              </div>
            </Link>
          ))}

          {!loading && doctors.length === 0 && (
            <div className="col-span-3 card-panel rounded-2xl p-12 text-center">
              <p className="text-stone-500 text-sm">No doctors found matching criteria.</p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
