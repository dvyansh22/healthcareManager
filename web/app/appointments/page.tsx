"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import Navbar from "@/components/Navbar";

interface Appointment {
  id: string;
  slotStart: string;
  slotEnd: string;
  status: string;
  symptomText?: string;
  doctorName?: string;
  doctorSpecialization?: string;
  postVisitSummary?: string;
  postVisitLlmStatus?: string;
  hasCalendarEvent?: boolean;
  createdAt: string;
}

export default function AppointmentsPage() {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState<string | null>(null);

  useEffect(() => { fetchAppointments(); }, []);

  const [cancelModal, setCancelModal] = useState<string | null>(null);

  async function fetchAppointments() {
    setLoading(true);
    try {
      const data = await apiFetch<Appointment[]>("api/appointments/mine");
      setAppointments(data);
    } finally {
      setLoading(false);
    }
  }

  async function cancelAppointment(id: string) {
    setCancelling(id);
    try {
      await apiFetch(`api/appointments/${id}/cancel`, { method: "POST" });
      fetchAppointments();
      setCancelModal(null);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setCancelling(null);
    }
  }

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleString([], { dateStyle: "medium", timeStyle: "short" });

  const getStatusBadge = (status: string) => {
    if (status === "Confirmed") return <span className="badge badge-emerald">Confirmed</span>;
    if (status === "Completed") return <span className="badge badge-yellow">Completed</span>;
    if (status === "Cancelled" || status === "LeaveCancelled") return <span className="badge badge-rose">Cancelled</span>;
    return <span className="badge badge-amber">{status}</span>;
  };

  const getGoogleCalendarUrl = (a: Appointment) => {
    const start = new Date(a.slotStart).toISOString().replace(/-|:|\.\d\d\d/g, "");
    const end = new Date(a.slotEnd).toISOString().replace(/-|:|\.\d\d\d/g, "");
    const title = encodeURIComponent(`Medical Appointment with Dr. ${a.doctorName}`);
    const details = encodeURIComponent(`Specialization: ${a.doctorSpecialization || ""}\n\nSymptoms reported: ${a.symptomText || "None"}`);
    return `https://calendar.google.com/calendar/r/eventedit?text=${title}&dates=${start}/${end}&details=${details}`;
  };

  return (
    <div className="min-h-screen bg-[#fafaf9] text-stone-900 flex flex-col">
      <Navbar />

      <main className="max-w-4xl w-full mx-auto px-6 py-10 flex-1">
        <div className="mb-8 border-b border-stone-200 pb-6">
          <h1 className="text-2xl font-bold tracking-tight text-stone-900">My Appointments</h1>
          <p className="text-stone-600 text-sm mt-1">Track upcoming visits, clinical notes, and post-visit medical summaries</p>
        </div>

        {loading && (
          <div className="flex justify-center py-20">
            <span className="spinner scale-150" />
          </div>
        )}

        {!loading && appointments.length === 0 && (
          <div className="card-panel rounded-2xl p-12 text-center">
            <p className="text-stone-500 text-sm mb-4">No appointments found.</p>
            <a href="/doctors" className="btn-primary px-5 py-2 rounded-xl text-xs font-semibold inline-block">
              Find a Doctor
            </a>
          </div>
        )}

        <div className="space-y-4">
          {appointments.map((a) => (
            <div key={a.id} id={`appt-${a.id}`} className="card-panel rounded-2xl p-6 animate-fade-in">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-xl bg-amber-100 border border-amber-300 flex items-center justify-center text-amber-900 font-bold text-base shadow-2xs">
                    🩺
                  </div>
                  <div>
                    <p className="font-bold text-stone-900 text-base">Dr. {a.doctorName}</p>
                    <p className="text-amber-800 text-xs font-bold">{a.doctorSpecialization}</p>
                    <p className="text-stone-500 text-xs mt-1 font-mono font-medium">{formatDate(a.slotStart)}</p>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-2">
                  {getStatusBadge(a.status)}
                  {a.hasCalendarEvent && (
                    <span className="badge bg-blue-50 text-blue-700 border-blue-200 flex items-center gap-1">
                      🗓️ Synced to Google Calendar
                    </span>
                  )}
                </div>
              </div>

              {a.symptomText && (
                <div className="mt-4 pt-3 border-t border-stone-200">
                  <p className="text-xs text-stone-700">
                    <span className="font-bold uppercase tracking-wider text-[10px] text-stone-500 block mb-0.5">Reported Symptoms</span>
                    {a.symptomText}
                  </p>
                </div>
              )}

              {/* Post-visit Summary Drawer */}
              {a.postVisitSummary && (
                <div className="mt-4 pt-3 border-t border-stone-200">
                  <button
                    onClick={() => setExpanded(expanded === a.id ? null : a.id)}
                    className="text-xs font-bold text-amber-800 hover:text-amber-900 transition flex items-center gap-1"
                  >
                    <span>{expanded === a.id ? "Hide" : "View"} Clinical Post-Visit Summary</span>
                    <span>{expanded === a.id ? "↑" : "↓"}</span>
                  </button>

                  {expanded === a.id && (
                    <div className="mt-3 bg-amber-50/60 border border-amber-200/80 rounded-xl p-4 text-xs space-y-3">
                      {(() => {
                        try {
                          const s = JSON.parse(a.postVisitSummary!);
                          return (
                            <>
                              <div>
                                <span className="font-bold uppercase tracking-wider text-[10px] text-amber-900 block mb-1">
                                  Doctor's Summary
                                </span>
                                <p className="text-stone-800 leading-relaxed font-medium">{s.summary_text}</p>
                              </div>
                              {s.follow_up_steps?.length > 0 && (
                                <div>
                                  <span className="font-bold uppercase tracking-wider text-[10px] text-amber-900 block mb-1">
                                    Follow-up Instructions
                                  </span>
                                  <ul className="list-disc list-inside text-stone-800 space-y-1 font-medium">
                                    {s.follow_up_steps.map((step: string, i: number) => (
                                      <li key={i}>{step}</li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                            </>
                          );
                        } catch {
                          return <p className="text-stone-800 font-medium">{a.postVisitSummary}</p>;
                        }
                      })()}
                    </div>
                  )}
                </div>
              )}

              {/* Actions */}
              {a.status === "Confirmed" && (
                <div className="mt-4 pt-3 border-t border-stone-200 flex justify-between items-center">
                  <a
                    href={getGoogleCalendarUrl(a)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs font-semibold text-blue-700 hover:text-blue-800 border border-blue-200 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg transition flex items-center gap-1.5"
                  >
                    🗓️ Add to Calendar
                  </a>
                  <button
                    id={`cancel-appt-${a.id}`}
                    onClick={() => setCancelModal(a.id)}
                    className="text-xs font-semibold text-rose-700 hover:text-rose-800 border border-rose-200 bg-rose-50 hover:bg-rose-100 px-3 py-1.5 rounded-lg transition flex items-center gap-1.5"
                  >
                    Cancel Appointment
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      </main>

      {/* Cancel Confirmation Modal */}
      {cancelModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-950/40 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden border border-stone-200">
            <div className="p-6">
              <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mb-4 mx-auto">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <h3 className="text-lg font-bold text-center text-stone-900 mb-2">Cancel Appointment?</h3>
              <p className="text-sm text-center text-stone-600">
                Are you sure you want to cancel this appointment? This action cannot be undone and your slot will be released.
              </p>
            </div>
            <div className="p-4 bg-stone-50 border-t border-stone-100 flex gap-3">
              <button
                onClick={() => setCancelModal(null)}
                disabled={cancelling !== null}
                className="flex-1 px-4 py-2 text-sm font-semibold text-stone-700 bg-white border border-stone-300 rounded-xl hover:bg-stone-100 transition"
              >
                Go Back
              </button>
              <button
                onClick={() => cancelAppointment(cancelModal)}
                disabled={cancelling !== null}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-rose-600 rounded-xl hover:bg-rose-700 transition shadow-sm"
              >
                {cancelling === cancelModal && <span className="spinner border-white" />}
                {cancelling === cancelModal ? "Cancelling..." : "Yes, Cancel"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
