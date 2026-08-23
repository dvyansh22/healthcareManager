"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import Navbar from "@/components/Navbar";

interface Slot { slotStart: string; slotEnd: string; }
interface DoctorInfo { id: string; name: string; specialization: string; bio?: string; }

type BookingStep = "pick-date" | "pick-slot" | "symptoms" | "confirming" | "done";

export default function DoctorDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [doctor, setDoctor] = useState<DoctorInfo | null>(null);
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);
  const [holdId, setHoldId] = useState<string | null>(null);
  const [symptomText, setSymptomText] = useState("");
  const [step, setStep] = useState<BookingStep>("pick-date");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    apiFetch<DoctorInfo[]>("api/doctors").then((docs) => {
      const doc = docs.find((d) => d.id === id);
      if (doc) setDoctor(doc);
    });
  }, [id]);

  async function loadSlots() {
    setError("");
    setLoading(true);
    try {
      const data = await apiFetch<{ slots: Slot[] }>(`api/doctors/${id}/availability?date=${date}`);
      setSlots(data.slots ?? []);
      setStep("pick-slot");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function holdSlot(slot: Slot) {
    setError("");
    setLoading(true);
    try {
      const data = await apiFetch<{ holdId: string }>(`api/appointments/hold`, {
        method: "POST",
        body: JSON.stringify({ doctorId: id, slotStart: slot.slotStart }),
      });
      setHoldId(data.holdId);
      setSelectedSlot(slot);
      setStep("symptoms");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function confirmBooking() {
    if (!holdId) return;
    setError("");
    setLoading(true);
    setStep("confirming");
    try {
      await apiFetch("api/appointments/confirm", {
        method: "POST",
        body: JSON.stringify({ holdId, symptomText }),
      });
      setStep("done");
    } catch (err: any) {
      setError(err.message);
      setStep("symptoms");
    } finally {
      setLoading(false);
    }
  }

  const formatTime = (iso: string) =>
    new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  return (
    <div className="min-h-screen bg-[#fafaf9] text-stone-900 flex flex-col">
      <Navbar />

      <main className="max-w-3xl w-full mx-auto px-6 py-10 flex-1">
        {/* Doctor Header Banner */}
        {doctor && (
          <div className="card-panel rounded-2xl p-6 mb-8 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-amber-100 border border-amber-300 flex items-center justify-center text-amber-900 font-bold text-xl">
                {doctor.name.split(" ").map(n => n[0]).slice(-2).join("")}
              </div>
              <div>
                <h1 className="text-xl font-bold text-stone-900">Dr. {doctor.name}</h1>
                <p className="text-amber-800 text-xs font-bold mt-0.5">{doctor.specialization}</p>
                {doctor.bio && <p className="text-stone-600 text-xs mt-1">{doctor.bio}</p>}
              </div>
            </div>
            <button
              onClick={() => router.push("/doctors")}
              className="text-xs text-stone-600 hover:text-stone-900 font-semibold border border-stone-300 px-3 py-1.5 rounded-lg transition"
            >
              ← Back
            </button>
          </div>
        )}

        {/* Step Progress Pills */}
        <div className="flex items-center gap-2 mb-8 text-xs font-semibold border-b border-stone-200 pb-4">
          <span className={`px-3 py-1 rounded-full ${step === "pick-date" ? "badge-yellow" : "text-stone-400"}`}>
            1. Select Date
          </span>
          <span className="text-stone-300">→</span>
          <span className={`px-3 py-1 rounded-full ${step === "pick-slot" ? "badge-yellow" : "text-stone-400"}`}>
            2. Pick Slot
          </span>
          <span className="text-stone-300">→</span>
          <span className={`px-3 py-1 rounded-full ${step === "symptoms" ? "badge-yellow" : "text-stone-400"}`}>
            3. Intake Symptoms
          </span>
          <span className="text-stone-300">→</span>
          <span className={`px-3 py-1 rounded-full ${step === "done" ? "badge-emerald" : "text-stone-400"}`}>
            4. Complete
          </span>
        </div>

        {/* Step 1: Pick Date */}
        {step === "pick-date" && (
          <div className="card-panel rounded-2xl p-6 animate-fade-in space-y-4">
            <h2 className="font-bold text-stone-900 text-base">Select Consultation Date</h2>
            <div>
              <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-2">Date</label>
              <input
                id="availability-date"
                type="date"
                value={date}
                min={new Date().toISOString().split("T")[0]}
                onChange={(e) => setDate(e.target.value)}
                className="w-full input-field rounded-xl px-4 py-2.5 text-sm"
              />
            </div>
            {error && <p className="text-rose-600 text-xs font-medium">{error}</p>}
            <button
              id="check-availability-btn"
              onClick={loadSlots}
              disabled={loading}
              className="w-full btn-primary py-2.5 rounded-xl text-sm font-semibold transition flex items-center justify-center gap-2"
            >
              {loading && <span className="spinner" />}
              Check Available Slots
            </button>
          </div>
        )}

        {/* Step 2: Pick Slot */}
        {step === "pick-slot" && (
          <div className="card-panel rounded-2xl p-6 animate-fade-in space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-stone-900 text-base">Available Times for {date}</h2>
              <button onClick={() => setStep("pick-date")} className="text-xs text-amber-800 font-semibold hover:underline">Change Date</button>
            </div>

            {slots.length === 0 ? (
              <p className="text-stone-500 text-sm py-8 text-center">No available slots on this date.</p>
            ) : (
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-3 pt-2">
                {slots.map((s) => (
                  <button
                    key={s.slotStart}
                    id={`slot-${s.slotStart}`}
                    onClick={() => holdSlot(s)}
                    disabled={loading}
                    className="bg-white border border-stone-300 hover:border-amber-500 hover:bg-amber-100/60 text-stone-900 py-3 rounded-xl text-xs font-bold transition shadow-2xs"
                  >
                    {formatTime(s.slotStart)}
                  </button>
                ))}
              </div>
            )}
            {error && <p className="text-rose-600 text-xs font-medium">{error}</p>}
          </div>
        )}

        {/* Step 3: Symptoms */}
        {step === "symptoms" && selectedSlot && (
          <div className="card-panel rounded-2xl p-6 animate-fade-in space-y-5">
            <div>
              <span className="badge badge-yellow mb-2">Slot Reserved (10 min hold)</span>
              <h2 className="font-bold text-stone-900 text-lg">Describe Your Symptoms</h2>
              <p className="text-xs text-stone-600 font-medium mt-1">
                Time: {formatTime(selectedSlot.slotStart)} – {formatTime(selectedSlot.slotEnd)}
              </p>
            </div>

            <div>
              <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-2">
                Reason for Visit / Symptoms
              </label>
              <textarea
                id="symptom-text"
                value={symptomText}
                onChange={(e) => setSymptomText(e.target.value)}
                rows={4}
                placeholder="Describe your symptoms, onset time, or concerns for the doctor…"
                className="w-full input-field rounded-xl px-4 py-2.5 text-sm resize-none"
              />
            </div>

            {error && <p className="text-rose-600 text-xs font-medium">{error}</p>}

            <button
              id="confirm-booking-btn"
              onClick={confirmBooking}
              disabled={loading}
              className="w-full btn-primary py-2.5 rounded-xl text-sm font-semibold transition flex items-center justify-center gap-2"
            >
              {loading && <span className="spinner" />}
              Confirm Appointment Booking
            </button>
          </div>
        )}

        {/* Step: Confirming */}
        {step === "confirming" && (
          <div className="card-panel rounded-2xl p-12 text-center animate-fade-in">
            <span className="spinner scale-150 mx-auto mb-4" />
            <p className="text-stone-700 text-sm font-semibold">Securing appointment & generating summary…</p>
          </div>
        )}

        {/* Step 4: Done */}
        {step === "done" && (
          <div className="card-panel rounded-2xl p-10 text-center animate-fade-in space-y-4">
            <div className="w-14 h-14 bg-emerald-100 border border-emerald-300 rounded-2xl flex items-center justify-center text-emerald-900 mx-auto font-bold">
              <svg className="w-7 h-7" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-stone-900">Appointment Confirmed</h2>
            <p className="text-stone-600 text-xs max-w-md mx-auto font-medium">
              Your appointment has been registered with Dr. {doctor?.name}. A confirmation email has been logged.
            </p>
            <button
              onClick={() => router.push("/appointments")}
              className="btn-primary px-6 py-2.5 rounded-xl text-xs font-semibold transition"
            >
              View My Appointments
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
