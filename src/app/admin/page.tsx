"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AdminShell } from "@/components/admin/admin-shell";
import { SubjectTable } from "@/components/admin/subject-table";
import type { SubjectWithQuestions } from "@/data/interfaces/types";

export default function AdminDashboardPage() {
  const [subjects, setSubjects] = useState<SubjectWithQuestions[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchSubjects = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/subjects");
    const data = await res.json();
    setSubjects(data);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchSubjects();
  }, [fetchSubjects]);

  return (
    <AdminShell>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Sujets</h1>
          <Link href="/admin/sujets/nouveau">
            <Button>Nouveau sujet</Button>
          </Link>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Liste des sujets</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-center text-muted-foreground py-8">
                Chargement...
              </p>
            ) : (
              <SubjectTable subjects={subjects} onRefresh={fetchSubjects} />
            )}
          </CardContent>
        </Card>
      </div>
    </AdminShell>
  );
}
