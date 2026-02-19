"use client";

import Link from "next/link";
import { LogoutButton } from "./logout-button";

export function AdminShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b bg-white">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <Link href="/admin" className="text-xl font-bold">
            Makana Admin
          </Link>
          <LogoutButton />
        </div>
      </header>
      <main className="container mx-auto px-4 py-8">{children}</main>
    </div>
  );
}
