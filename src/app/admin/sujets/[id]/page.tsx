"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { AdminShell } from "@/components/admin/admin-shell";
import { SubjectForm } from "@/components/admin/subject-form";
import type { SubjectFormData } from "@/lib/schemas/subject";
import type { SubjectWithQuestions } from "@/data/interfaces/types";
import type { Question } from "@/data/interfaces/database";

export default function EditSubjectPage() {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<
    (SubjectFormData & { id: string }) | null
  >(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const res = await fetch(`/api/subjects/${id}`);
      const subject: SubjectWithQuestions = await res.json();
      const sorted = [...subject.questions].sort(
        (a: Question, b: Question) => a.display_order - b.display_order
      );
      setData({
        id: subject.id,
        reference_text: subject.reference_text,
        questions: sorted.map((q: Question) => ({
          question_text: q.question_text,
          expected_answer_guidelines: q.expected_answer_guidelines,
        })),
      });
      setLoading(false);
    }
    load();
  }, [id]);

  if (loading) {
    return (
      <AdminShell>
        <p className="text-center text-muted-foreground py-8">Chargement...</p>
      </AdminShell>
    );
  }

  if (!data) {
    return (
      <AdminShell>
        <p className="text-center text-red-600 py-8">Sujet introuvable</p>
      </AdminShell>
    );
  }

  return (
    <AdminShell>
      <div className="max-w-3xl mx-auto space-y-6">
        <h1 className="text-2xl font-bold">Modifier le sujet</h1>
        <SubjectForm initialData={data} />
      </div>
    </AdminShell>
  );
}
