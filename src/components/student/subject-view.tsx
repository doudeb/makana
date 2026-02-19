"use client";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { AnswerForm } from "./answer-form";
import type { SubjectWithQuestions } from "@/data/interfaces/types";

interface SubjectViewProps {
  subject: SubjectWithQuestions;
  studentName: string;
}

export function SubjectView({ subject, studentName }: SubjectViewProps) {
  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Sujet de droit</h1>
        <p className="text-muted-foreground">
          Bienvenue {studentName} ! Lisez attentivement le texte puis repondez
          aux questions.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Texte de reference</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="whitespace-pre-wrap text-sm leading-relaxed">
            {subject.reference_text}
          </p>
        </CardContent>
      </Card>

      <Separator />

      <AnswerForm
        subjectId={subject.id}
        studentName={studentName}
        questions={subject.questions}
      />
    </div>
  );
}
