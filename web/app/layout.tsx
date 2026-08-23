import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import RouteGuard from "@/components/RouteGuard";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: "HealthCore — Healthcare Appointment Manager",
  description:
    "Book appointments, track your health, and manage prescriptions with AI-powered insights.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${inter.variable} h-full`}>
      <body className="min-h-full bg-[#fafaf9] text-stone-900 font-inter antialiased">
        <RouteGuard>{children}</RouteGuard>
      </body>
    </html>
  );
}
