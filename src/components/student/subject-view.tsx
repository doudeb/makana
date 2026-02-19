"use client";

import { AnswerForm } from "./answer-form";
import type { SubjectWithQuestions } from "@/data/interfaces/types";

interface SubjectViewProps {
  subject: SubjectWithQuestions;
  studentName: string;
}

export function SubjectView({ subject, studentName }: SubjectViewProps) {
  return (
    <AnswerForm
      subjectId={subject.id}
      studentName={studentName}
      questions={subject.questions}
    />
  );
}
