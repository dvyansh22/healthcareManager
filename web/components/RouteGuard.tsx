"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { getRole } from "@/lib/api";

const PUBLIC_ROUTES = ["/login", "/register"];

export default function RouteGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [authorized, setAuthorized] = useState(false);

  useEffect(() => {
    const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
    const role = getRole();

    // 1. Unauthenticated user
    if (!token) {
      if (PUBLIC_ROUTES.includes(pathname) || pathname === "/") {
        setAuthorized(true);
      } else {
        setAuthorized(false);
        router.replace("/login");
      }
      return;
    }

    // 2. Authenticated user visiting public auth routes (/login, /register)
    if (PUBLIC_ROUTES.includes(pathname)) {
      setAuthorized(false);
      if (role === "Doctor") router.replace("/doctor/schedule");
      else if (role === "Admin") router.replace("/admin/doctors");
      else router.replace("/doctors");
      return;
    }

    // 3. Authenticated user visiting role-restricted routes
    // Doctor routes match /doctor or /doctor/... (NOT /doctors)
    const isDoctorRoute = pathname === "/doctor" || pathname.startsWith("/doctor/");
    const isAdminRoute = pathname === "/admin" || pathname.startsWith("/admin/");

    if (isDoctorRoute && role !== "Doctor") {
      setAuthorized(false);
      router.replace(role === "Admin" ? "/admin/doctors" : "/doctors");
      return;
    }

    if (isAdminRoute && role !== "Admin") {
      setAuthorized(false);
      router.replace(role === "Doctor" ? "/doctor/schedule" : "/doctors");
      return;
    }

    setAuthorized(true);
  }, [pathname, router]);

  if (!authorized && !PUBLIC_ROUTES.includes(pathname) && pathname !== "/") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0a0f1e]">
        <span className="spinner scale-150" />
      </div>
    );
  }

  return <>{children}</>;
}
