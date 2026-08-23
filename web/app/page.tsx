"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { getRole } from "@/lib/api";

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      router.replace("/login");
      return;
    }

    const role = getRole();
    if (role === "Doctor") {
      router.replace("/doctor/schedule");
    } else if (role === "Admin") {
      router.replace("/admin/doctors");
    } else {
      router.replace("/doctors");
    }
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <span className="spinner scale-150" />
    </div>
  );
}
