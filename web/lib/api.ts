const BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:5000";

export type ApiError = { error: string };

export async function apiFetch<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token =
    typeof window !== "undefined" ? localStorage.getItem("token") : null;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(`${BASE_URL}/${path.replace(/^\//, "")}`, {
    ...options,
    headers,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw Object.assign(new Error(body.error ?? "Request failed"), {
      status: res.status,
      body,
    });
  }

  // Handle 204 No Content
  if (res.status === 204) return null as T;
  return res.json();
}

/** Decode the role from the stored JWT without a library */
export function getRole(): "Patient" | "Doctor" | "Admin" | null {
  if (typeof window === "undefined") return null;
  const token = localStorage.getItem("token");
  if (!token) return null;
  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    const raw =
      payload["http://schemas.microsoft.com/ws/2008/06/identity/claims/role"] ??
      payload.role ??
      payload.Role ??
      null;

    if (raw === "Doctor" || raw === 1 || raw === "1") return "Doctor";
    if (raw === "Admin" || raw === 2 || raw === "2") return "Admin";
    if (raw === "Patient" || raw === 0 || raw === "0") return "Patient";

    // Fallback: check stored user object in localStorage
    const userStr = localStorage.getItem("user");
    if (userStr) {
      const u = JSON.parse(userStr);
      const r = u.role ?? u.Role;
      if (r === "Doctor" || r === 1 || r === "1") return "Doctor";
      if (r === "Admin" || r === 2 || r === "2") return "Admin";
      if (r === "Patient" || r === 0 || r === "0") return "Patient";
    }
    return null;
  } catch {
    return null;
  }
}


export function getUserId(): string | null {
  if (typeof window === "undefined") return null;
  const token = localStorage.getItem("token");
  if (!token) return null;
  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    return payload.sub ?? null;
  } catch {
    return null;
  }
}

export function logout() {
  localStorage.removeItem("token");
  localStorage.removeItem("user");
  window.location.href = "/login";
}
