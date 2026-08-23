"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { getRole, logout } from "@/lib/api";
import { useEffect, useState } from "react";

export default function Navbar() {
  const pathname = usePathname();
  const [role, setRole] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);

  useEffect(() => {
    setRole(getRole());
    const userStr = localStorage.getItem("user");
    if (userStr) {
      try {
        const u = JSON.parse(userStr);
        setUserEmail(u.email);
      } catch {}
    }
  }, []);

  return (
    <header className="sticky top-0 z-30 bg-white/90 backdrop-blur-md border-b border-stone-200 px-6 py-3.5 shadow-sm">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        {/* Brand Header */}
        <Link href="/" className="flex items-center gap-3 group">
          <div className="w-9 h-9 rounded-lg bg-amber-400 border border-amber-500/40 flex items-center justify-center text-stone-950 font-bold group-hover:bg-amber-300 transition shadow-xs">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
          </div>
          <div>
            <span className="font-bold text-stone-900 tracking-tight text-base block">HealthCore</span>
            <span className="text-[10px] uppercase font-bold tracking-wider text-amber-700 block -mt-1">
              Clinical Manager
            </span>
          </div>
        </Link>

        {/* Navigation links */}
        <nav className="flex items-center gap-1 bg-stone-100 border border-stone-200 p-1 rounded-xl text-sm">
          {role === "Patient" && (
            <>
              <Link
                href="/doctors"
                className={`px-4 py-1.5 rounded-lg font-medium transition ${
                  pathname.startsWith("/doctors")
                    ? "bg-amber-400 text-stone-950 shadow-xs font-semibold"
                    : "text-stone-600 hover:text-stone-900"
                }`}
              >
                Find Doctors
              </Link>
              <Link
                href="/appointments"
                className={`px-4 py-1.5 rounded-lg font-medium transition ${
                  pathname.startsWith("/appointments")
                    ? "bg-amber-400 text-stone-950 shadow-xs font-semibold"
                    : "text-stone-600 hover:text-stone-900"
                }`}
              >
                My Appointments
              </Link>
            </>
          )}

          {role === "Doctor" && (
            <>
              <Link
                href="/doctor/schedule"
                className={`px-4 py-1.5 rounded-lg font-medium transition ${
                  pathname === "/doctor/schedule"
                    ? "bg-amber-400 text-stone-950 shadow-xs font-semibold"
                    : "text-stone-600 hover:text-stone-900"
                }`}
              >
                Physician Schedule
              </Link>
              <Link
                href="/doctor/profile"
                className={`px-4 py-1.5 rounded-lg font-medium transition ${
                  pathname === "/doctor/profile"
                    ? "bg-amber-400 text-stone-950 shadow-xs font-semibold"
                    : "text-stone-600 hover:text-stone-900"
                }`}
              >
                My Profile
              </Link>
            </>
          )}

          {role === "Admin" && (
            <Link
              href="/admin/doctors"
              className={`px-4 py-1.5 rounded-lg font-medium transition ${
                pathname.startsWith("/admin")
                  ? "bg-amber-400 text-stone-950 shadow-xs font-semibold"
                  : "text-stone-600 hover:text-stone-900"
              }`}
            >
              Doctor Management
            </Link>
          )}
        </nav>

        {/* User Info & Actions */}
        <div className="flex items-center gap-3">
          {role && (
            <span className="badge badge-amber">
              {role === "Doctor" ? "Physician" : role} Portal
            </span>
          )}
          {userEmail && (
            <span className="text-xs text-stone-500 font-medium hidden sm:inline-block max-w-[160px] truncate">
              {userEmail}
            </span>
          )}
          <button
            onClick={logout}
            className="text-xs font-semibold text-stone-600 hover:text-rose-700 border border-stone-300 hover:border-rose-300 px-3 py-1.5 rounded-lg transition bg-white"
          >
            Sign out
          </button>
        </div>
      </div>
    </header>
  );
}
