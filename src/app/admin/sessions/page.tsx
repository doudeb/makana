"use client";

import { useEffect, useState, useCallback } from "react";
import { AdminShell } from "@/components/admin/admin-shell";
import { SessionStats } from "@/components/admin/session-stats";
import { SessionTable } from "@/components/admin/session-table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type {
  SessionListItem,
  SessionStats as SessionStatsType,
} from "@/data/interfaces/types";
import type { Subject } from "@/data/interfaces/database";

export default function SessionsPage() {
  const [sessions, setSessions] = useState<SessionListItem[]>([]);
  const [stats, setStats] = useState<SessionStatsType>({
    total_sessions: 0,
    unique_students: 0,
    completion_rate: 0,
    average_score: 0,
    today_sessions: 0,
  });
  const [subjects, setSubjects] = useState<Pick<Subject, "id" | "code">[]>([]);
  const [selectedSubject, setSelectedSubject] = useState<string>("");
  const [loading, setLoading] = useState(true);

  const fetchSubjects = useCallback(async () => {
    const res = await fetch("/api/subjects");
    const data = await res.json();
    setSubjects(data.map((s: Subject & { questions: unknown[] }) => ({ id: s.id, code: s.code })));
  }, []);

  const fetchSessions = useCallback(async (subjectId?: string) => {
    setLoading(true);
    const url = subjectId
      ? `/api/sessions?subject_id=${subjectId}`
      : "/api/sessions";
    const res = await fetch(url);
    const data = await res.json();
    setSessions(data.sessions);
    setStats(data.stats);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchSubjects();
    fetchSessions();
  }, [fetchSubjects, fetchSessions]);

  function handleSubjectChange(value: string) {
    setSelectedSubject(value);
    fetchSessions(value || undefined);
  }

  return (
    <AdminShell>
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Sessions eleves</h1>

        {/* Filtre par sujet */}
        <div>
          <select
            value={selectedSubject}
            onChange={(e) => handleSubjectChange(e.target.value)}
            className="rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="">Tous les sujets</option>
            {subjects.map((s) => (
              <option key={s.id} value={s.id}>
                {s.code}
              </option>
            ))}
          </select>
        </div>

        {/* KPI */}
        <SessionStats stats={stats} />

        {/* Tableau */}
        <Card>
          <CardHeader>
            <CardTitle>Liste des sessions</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-center text-muted-foreground py-8">
                Chargement...
              </p>
            ) : (
              <SessionTable sessions={sessions} />
            )}
          </CardContent>
        </Card>
      </div>
    </AdminShell>
  );
}
