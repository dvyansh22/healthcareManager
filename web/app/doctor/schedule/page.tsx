"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/api";
import Navbar from "@/components/Navbar";

interface Appointment {
  id: string;
  slotStart: string;
  slotEnd: string;
  status: string;
  patientName?: string;
  symptomText?: string;
  preVisitSummary?: string;
  postVisitLlmStatus?: string;
  hasCalendarEvent?: boolean;
  createdAt: string;
}

export default function DoctorSchedulePage() {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch<Appointment[]>("api/appointments/mine").then((data) => {
      setAppointments(data);
    }).finally(() => setLoading(false));
  }, []);

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleString([], { dateStyle: "medium", timeStyle: "short" });

  const getGoogleCalendarUrl = (a: Appointment) => {
    const start = new Date(a.slotStart).toISOString().replace(/-|:|\.\d\d\d/g, "");
    const end = new Date(a.slotEnd).toISOString().replace(/-|:|\.\d\d\d/g, "");
    const title = encodeURIComponent(`Consultation with ${a.patientName || "Patient"}`);
    const details = encodeURIComponent(`Symptoms reported: ${a.symptomText || "None"}`);
    return `https://calendar.google.com/calendar/r/eventedit?text=${title}&dates=${start}/${end}&details=${details}`;
  };

  const upcoming = appointments.filter((a) => a.status === "Confirmed");
  const past = appointments.filter((a) => a.status !== "Confirmed");

  return (
    <div className="min-h-screen bg-[#fafaf9] text-stone-900 flex flex-col">
      <Navbar />

      <main className="max-w-4xl w-full mx-auto px-6 py-10 flex-1">
        <div className="mb-8 border-b border-stone-200 pb-6">
          <h1 className="text-2xl font-bold tracking-tight text-stone-900">Physician Daily Schedule</h1>
          <p className="text-stone-600 text-sm mt-1">Review scheduled patient consultations, AI pre-visit intake, and submit clinical notes</p>
        </div>

        {loading && (
          <div className="flex justify-center py-20">
            <span className="spinner scale-150" />
          </div>
        )}

        {/* Upcoming Consultations */}
        {upcoming.length > 0 && (
          <section className="mb-10">
            <h2 className="text-xs font-bold uppercase tracking-wider text-amber-800 mb-4 flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
              Upcoming Consultations ({upcoming.length})
            </h2>

            <div className="space-y-3">
              {upcoming.map((a) => (
                <Link
                  key={a.id}
                  href={`/doctor/appointments/${a.id}`}
                  id={`schedule-appt-${a.id}`}
                  className="card-interactive rounded-2xl p-5 flex items-center justify-between group"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-amber-100 border border-amber-300 flex items-center justify-center text-amber-900 font-bold text-sm">
                      👤
                    </div>
                    <div>
                      <p className="font-bold text-stone-900 group-hover:text-amber-800 transition text-sm">
                        {a.patientName ?? "Patient"}
                      </p>
                      <p className="text-xs text-stone-500 font-mono font-medium mt-0.5">{formatDate(a.slotStart)}</p>
                      {a.symptomText && (
                        <p className="text-stone-600 text-xs mt-1 line-clamp-1">
                          <span className="text-stone-400 font-semibold">Symptoms: </span>{a.symptomText}
                        </p>
                      )}
                      <div className="mt-2" onClick={(e) => e.stopPropagation()}>
                        <a
                          href={getGoogleCalendarUrl(a)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[10px] font-semibold text-blue-700 hover:text-blue-800 border border-blue-200 bg-blue-50 hover:bg-blue-100 px-2 py-1 rounded transition inline-flex items-center gap-1"
                        >
                          🗓️ Add to Calendar
                        </a>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-2">
                    <div className="flex items-center gap-3">
                      {a.hasCalendarEvent && (
                        <span className="badge bg-blue-50 text-blue-700 border-blue-200">
                          🗓️ Synced
                        </span>
                      )}
                      <span className="badge badge-emerald">Confirmed</span>
                    </div>
                    <span className="text-xs text-amber-800 font-bold group-hover:translate-x-0.5 transition">
                      View Record →
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* Past Records */}
        {past.length > 0 && (
          <section>
            <h2 className="text-xs font-bold uppercase tracking-wider text-stone-500 mb-4">
              Past / Completed Records ({past.length})
            </h2>

            <div className="space-y-3">
              {past.map((a) => (
                <Link
                  key={a.id}
                  href={`/doctor/appointments/${a.id}`}
                  id={`schedule-past-${a.id}`}
                  className="card-panel rounded-2xl p-4 flex items-center justify-between hover:bg-stone-50 transition"
                >
                  <div>
                    <p className="font-bold text-stone-800 text-sm">{a.patientName ?? "Patient"}</p>
                    <p className="text-xs text-stone-500 font-mono font-medium">{formatDate(a.slotStart)}</p>
                  </div>
                  <span className={`badge ${a.status === "Completed" ? "badge-yellow" : "badge-rose"}`}>
                    {a.status}
                  </span>
                </Link>
              ))}
            </div>
          </section>
        )}

        {!loading && appointments.length === 0 && (
          <div className="card-panel rounded-2xl p-12 text-center">
            <p className="text-stone-500 text-sm">No consultations found on your schedule.</p>
          </div>
        )}
      </main>
    </div>
  );
}
