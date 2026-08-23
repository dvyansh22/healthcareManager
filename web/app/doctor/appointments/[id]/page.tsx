"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
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
  postVisitSummary?: string;
  postVisitLlmStatus: string;
}

interface PrescriptionInput {
  medicationName: string;
  dosage: string;
  frequencyPerDay: number;
  durationDays: number;
  startDate: string;
}

const EMPTY_RX: PrescriptionInput = {
  medicationName: "",
  dosage: "",
  frequencyPerDay: 1,
  durationDays: 7,
  startDate: new Date().toISOString().split("T")[0],
};

export default function DoctorAppointmentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [appt, setAppt] = useState<Appointment | null>(null);
  const [loading, setLoading] = useState(true);
  const [clinicalNotes, setClinicalNotes] = useState("");
  const [prescriptions, setPrescriptions] = useState<PrescriptionInput[]>([{ ...EMPTY_RX }]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    apiFetch<Appointment[]>("api/appointments/mine")
      .then((data) => {
        const found = data.find((a) => a.id === id);
        if (found) setAppt(found);
      })
      .finally(() => setLoading(false));
  }, [id]);

  function updateRx(i: number, field: keyof PrescriptionInput, value: string | number) {
    const next = [...prescriptions];
    (next[i] as any)[field] = value;
    setPrescriptions(next);
  }

  function addRx() { setPrescriptions([...prescriptions, { ...EMPTY_RX }]); }
  function removeRx(i: number) { setPrescriptions(prescriptions.filter((_, idx) => idx !== i)); }

  async function submitNotes(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      await apiFetch(`api/appointments/${id}/notes`, {
        method: "POST",
        body: JSON.stringify({ clinicalNotes, prescriptions }),
      });
      setSuccess(true);
      setTimeout(() => router.push("/doctor/schedule"), 1800);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  const preVisitData = (() => {
    if (!appt?.preVisitSummary) return null;
    try { return JSON.parse(appt.preVisitSummary); } catch { return null; }
  })();

  if (loading) return (
    <div className="min-h-screen bg-[#fafaf9] text-stone-900 flex flex-col">
      <Navbar />
      <div className="flex-1 flex items-center justify-center"><span className="spinner scale-150" /></div>
    </div>
  );

  if (!appt) return (
    <div className="min-h-screen bg-[#fafaf9] text-stone-900 flex flex-col">
      <Navbar />
      <div className="flex-1 flex items-center justify-center text-stone-500 text-sm">Consultation record not found.</div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#fafaf9] text-stone-900 flex flex-col">
      <Navbar />

      <main className="max-w-3xl w-full mx-auto px-6 py-10 flex-1 space-y-6">
        {/* Header */}
        <div className="card-panel rounded-2xl p-6 flex items-center justify-between">
          <div>
            <span className="badge badge-yellow mb-2">Patient Consultation</span>
            <h1 className="text-xl font-bold text-stone-900">{appt.patientName}</h1>
            <p className="text-xs text-stone-500 font-mono font-medium mt-0.5">
              Scheduled: {new Date(appt.slotStart).toLocaleString()}
            </p>
          </div>
          <button
            onClick={() => router.push("/doctor/schedule")}
            className="text-xs font-semibold text-stone-600 hover:text-stone-900 border border-stone-300 px-3 py-1.5 rounded-lg transition"
          >
            ← Back
          </button>
        </div>

        {/* Patient Symptoms */}
        {appt.symptomText && (
          <div className="card-panel rounded-2xl p-5 border-l-4 border-l-amber-500">
            <span className="font-bold uppercase tracking-wider text-[10px] text-amber-900 block mb-1">
              Patient-Reported Intake Symptoms
            </span>
            <p className="text-stone-800 text-sm font-medium">{appt.symptomText}</p>
          </div>
        )}

        {/* AI Pre-Visit Triage Card */}
        {preVisitData && (
          <div className="card-panel rounded-2xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-amber-900 flex items-center gap-2">
                🤖 AI Pre-Visit Clinical Summary
              </span>
              <span className={`badge ${
                preVisitData.urgency === "High" ? "badge-rose" :
                preVisitData.urgency === "Medium" ? "badge-amber" : "badge-emerald"
              }`}>
                Triage Urgency: {preVisitData.urgency ?? "Normal"}
              </span>
            </div>

            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-stone-500 block mb-0.5">
                Chief Complaint Analysis
              </span>
              <p className="text-stone-800 text-xs leading-relaxed font-medium">{preVisitData.chief_complaint}</p>
            </div>

            {preVisitData.questions?.length > 0 && (
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-stone-500 block mb-1">
                  Suggested Consultation Intake Questions
                </span>
                <ul className="space-y-1">
                  {preVisitData.questions.map((q: string, i: number) => (
                    <li key={i} className="text-stone-800 text-xs flex items-start gap-2 font-medium">
                      <span className="text-amber-600">•</span>
                      <span>{q}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* Form: Submit Clinical Notes & Prescriptions */}
        {appt.status === "Confirmed" && !success && (
          <form onSubmit={submitNotes} className="card-panel rounded-2xl p-6 space-y-6 animate-fade-in">
            <h2 className="text-base font-bold text-stone-900">Submit Clinical Notes & Medication Schedule</h2>

            <div>
              <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-2">
                Clinical Diagnosis & Consultation Notes
              </label>
              <textarea
                id="clinical-notes"
                value={clinicalNotes}
                onChange={(e) => setClinicalNotes(e.target.value)}
                rows={4}
                required
                placeholder="Enter physical examination findings, diagnosis, patient instruction, and follow-up plan…"
                className="w-full input-field rounded-xl px-4 py-2.5 text-sm resize-none"
              />
            </div>

            {/* Prescriptions Block */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-stone-700 uppercase tracking-wider">
                  Prescribed Medications
                </span>
                <button
                  type="button"
                  onClick={addRx}
                  className="text-xs text-amber-800 hover:text-amber-900 font-bold transition"
                >
                  + Add Medication
                </button>
              </div>

              <div className="space-y-3">
                {prescriptions.map((rx, i) => (
                  <div key={i} className="bg-stone-50 border border-stone-200 rounded-xl p-4 space-y-3">
                    <div className="flex items-center justify-between text-xs text-stone-600 font-semibold">
                      <span>Medication #{i + 1}</span>
                      {prescriptions.length > 1 && (
                        <button type="button" onClick={() => removeRx(i)} className="text-rose-700 hover:text-rose-800">
                          Remove
                        </button>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <input
                        id={`rx-${i}-name`}
                        value={rx.medicationName}
                        onChange={(e) => updateRx(i, "medicationName", e.target.value)}
                        required
                        placeholder="Medication Name (e.g. Amoxicillin)"
                        className="input-field rounded-lg px-3 py-2 text-xs"
                      />
                      <input
                        id={`rx-${i}-dosage`}
                        value={rx.dosage}
                        onChange={(e) => updateRx(i, "dosage", e.target.value)}
                        placeholder="Dosage (e.g. 500mg)"
                        className="input-field rounded-lg px-3 py-2 text-xs"
                      />
                      <input
                        id={`rx-${i}-freq`}
                        type="number"
                        min={1}
                        max={6}
                        value={rx.frequencyPerDay}
                        onChange={(e) => updateRx(i, "frequencyPerDay", +e.target.value)}
                        placeholder="Doses per day"
                        className="input-field rounded-lg px-3 py-2 text-xs"
                      />
                      <input
                        id={`rx-${i}-duration`}
                        type="number"
                        min={1}
                        value={rx.durationDays}
                        onChange={(e) => updateRx(i, "durationDays", +e.target.value)}
                        placeholder="Duration (Days)"
                        className="input-field rounded-lg px-3 py-2 text-xs"
                      />
                      <input
                        id={`rx-${i}-start`}
                        type="date"
                        value={rx.startDate}
                        onChange={(e) => updateRx(i, "startDate", e.target.value)}
                        required
                        className="col-span-2 input-field rounded-lg px-3 py-2 text-xs"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {error && <p className="text-rose-600 text-xs font-medium">{error}</p>}

            <button
              id="submit-notes-btn"
              type="submit"
              disabled={submitting}
              className="w-full btn-primary py-2.5 rounded-xl text-sm font-semibold transition flex items-center justify-center gap-2"
            >
              {submitting && <span className="spinner" />}
              {submitting ? "Submitting Clinical Record…" : "Finalize Consultation & Generate Post-Visit Summary"}
            </button>
          </form>
        )}

        {success && (
          <div className="card-panel rounded-2xl p-10 text-center animate-fade-in space-y-3">
            <div className="w-12 h-12 bg-emerald-100 border border-emerald-300 rounded-2xl flex items-center justify-center text-emerald-900 mx-auto font-bold">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
              </svg>
            </div>
            <p className="text-stone-900 font-bold text-sm">Consultation Completed & Reminders Scheduled</p>
            <p className="text-stone-600 text-xs">Redirecting to schedule…</p>
          </div>
        )}
      </main>
    </div>
  );
}
