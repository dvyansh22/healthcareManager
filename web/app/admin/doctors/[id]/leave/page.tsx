"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import Navbar from "@/components/Navbar";

export default function MarkLeavePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [leaveDate, setLeaveDate] = useState(new Date().toISOString().split("T")[0]);
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<{ appointmentsCancelled: number } | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const data = await apiFetch<{ appointmentsCancelled: number }>(
        `api/admin/doctors/${id}/leave`,
        {
          method: "POST",
          body: JSON.stringify({ leaveDate, reason }),
        }
      );
      setResult(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#fafaf9] text-stone-900 flex flex-col">
      <Navbar />

      <main className="max-w-xl w-full mx-auto px-6 py-12 flex-1">
        <button
          onClick={() => router.back()}
          className="text-xs font-semibold text-stone-600 hover:text-stone-900 border border-stone-300 px-3 py-1.5 rounded-lg transition mb-6"
        >
          ← Back to Roster
        </button>

        <div className="card-panel rounded-2xl p-8 space-y-6 animate-fade-in">
          <div>
            <span className="badge badge-amber mb-2">Leave Administration</span>
            <h1 className="text-xl font-bold text-stone-900">Schedule Doctor Absence</h1>
            <p className="text-xs text-stone-600 font-medium mt-1">
              Mark date of leave and trigger automatic cascade cancellation & notifications for affected patients.
            </p>
          </div>

          {!result ? (
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-2">
                  Leave Date
                </label>
                <input
                  id="leave-date"
                  type="date"
                  value={leaveDate}
                  onChange={(e) => setLeaveDate(e.target.value)}
                  required
                  className="w-full input-field rounded-xl px-4 py-2.5 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-2">
                  Reason for Absence (optional)
                </label>
                <input
                  id="leave-reason"
                  type="text"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="e.g. Medical Conference, Personal Leave…"
                  className="w-full input-field rounded-xl px-4 py-2.5 text-sm"
                />
              </div>

              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-xs text-amber-900 space-y-1 font-medium">
                <p className="font-bold uppercase tracking-wider text-[10px]">⚠️ Cascade Notice</p>
                <p>
                  Marking this leave will automatically update all confirmed appointments on this date to{" "}
                  <code className="bg-amber-100 px-1 py-0.5 rounded text-amber-900 font-bold">LeaveCancelled</code> and queue patient cancellation notifications.
                </p>
              </div>

              {error && <p className="text-rose-600 text-xs font-medium">{error}</p>}

              <button
                id="mark-leave-submit"
                type="submit"
                disabled={submitting}
                className="w-full bg-rose-700 hover:bg-rose-800 text-white py-2.5 rounded-xl text-sm font-semibold transition flex items-center justify-center gap-2 shadow-xs"
              >
                {submitting && <span className="spinner" />}
                {submitting ? "Processing Cascade…" : "Confirm Leave & Cancel Appointments"}
              </button>
            </form>
          ) : (
            <div className="text-center py-6 space-y-4">
              <div className="w-12 h-12 bg-emerald-100 border border-emerald-300 rounded-2xl flex items-center justify-center text-emerald-900 mx-auto font-bold">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                </svg>
              </div>
              <h2 className="text-lg font-bold text-stone-900">Leave Successfully Registered</h2>
              <p className="text-xs text-stone-600 font-medium">
                {result.appointmentsCancelled} appointment(s) cancelled and patient email notifications queued.
              </p>
              <button
                onClick={() => router.push("/admin/doctors")}
                className="btn-primary px-5 py-2.5 rounded-xl text-xs font-semibold transition"
              >
                Return to Doctor Roster
              </button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
