"use client";

import { useParams } from "next/navigation";
import { AdminShell } from "@/components/admin/admin-shell";
import { SessionDetail } from "@/components/admin/session-detail";

export default function SessionDetailPage() {
  const params = useParams<{ id: string }>();

  return (
    <AdminShell>
      <SessionDetail sessionId={params.id} />
    </AdminShell>
  );
}
