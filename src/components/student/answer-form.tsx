"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Question } from "@/data/interfaces/database";
import type { AnswerFeedback } from "@/data/interfaces/types";

interface AnswerFormProps {
  subjectId: string;
  studentName: string;
  questions: Question[];
}

export function AnswerForm({
  subjectId,
  studentName,
  questions,
}: AnswerFormProps) {
  const sorted = [...questions].sort(
    (a, b) => a.display_order - b.display_order
  );

  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [loadingQuestion, setLoadingQuestion] = useState<string | null>(null);
  const [feedbacks, setFeedbacks] = useState<Record<string, AnswerFeedback>>(
    {}
  );
  const [submissionId, setSubmissionId] = useState<string | null>(null);
  const [editing, setEditing] = useState<Record<string, boolean>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});

  function updateAnswer(questionId: string, value: string) {
    setAnswers((prev) => ({ ...prev, [questionId]: value }));
  }

  async function handleSubmitAnswer(questionId: string) {
    const answer = answers[questionId]?.trim();
    if (!answer) {
      setErrors((prev) => ({
        ...prev,
        [questionId]: "Veuillez ecrire une reponse",
      }));
      return;
    }

    setErrors((prev) => {
      const next = { ...prev };
      delete next[questionId];
      return next;
    });
    setLoadingQuestion(questionId);

    try {
      const res = await fetch("/api/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject_id: subjectId,
          student_name: studentName,
          submission_id: submissionId ?? undefined,
          question_id: questionId,
          student_answer: answer,
        }),
      });

      if (!res.ok) {
        throw new Error("Erreur lors de la soumission");
      }

      const result = await res.json();

      // Store the submission ID for subsequent answers
      if (!submissionId) {
        setSubmissionId(result.submission_id);
      }

      setFeedbacks((prev) => ({
        ...prev,
        [questionId]: {
          question_id: result.question_id,
          is_valid: result.is_valid,
          feedback: result.feedback,
        },
      }));
      setEditing((prev) => {
        const next = { ...prev };
        delete next[questionId];
        return next;
      });
    } catch {
      setErrors((prev) => ({
        ...prev,
        [questionId]: "Une erreur est survenue. Veuillez reessayer.",
      }));
    } finally {
      setLoadingQuestion(null);
    }
  }

  return (
    <div className="space-y-4">
      {sorted.map((question) => {
        const fb = feedbacks[question.id];
        const isLoading = loadingQuestion === question.id;
        const isEditing = editing[question.id];
        const questionError = errors[question.id];
        const showForm = !fb || isEditing;

        return (
          <Card key={question.id}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">
                  Question {question.display_order}
                </CardTitle>
                {fb && fb.is_valid !== null && (
                  <Badge variant={fb.is_valid ? "default" : "destructive"}>
                    {fb.is_valid ? "Valide" : "A retravailler"}
                  </Badge>
                )}
              </div>
              <p className="text-sm text-muted-foreground">
                {question.question_text}
              </p>
            </CardHeader>
            <CardContent className="space-y-3">
              {fb && !isEditing && (
                <div className="rounded-md bg-muted p-4">
                  <p className="text-sm whitespace-pre-wrap">{fb.feedback}</p>
                </div>
              )}
              {fb && !isEditing && !fb.is_valid && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setEditing((prev) => ({ ...prev, [question.id]: true }))
                  }
                >
                  Modifier ma reponse
                </Button>
              )}
              {showForm && (
                <>
                  <Label htmlFor={question.id} className="sr-only">
                    Votre reponse
                  </Label>
                  <Textarea
                    id={question.id}
                    rows={5}
                    placeholder="Redigez votre reponse ici..."
                    value={answers[question.id] || ""}
                    onChange={(e) => updateAnswer(question.id, e.target.value)}
                    disabled={isLoading}
                  />
                  {questionError && (
                    <p className="text-sm text-red-600">{questionError}</p>
                  )}
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      size="sm"
                      disabled={isLoading}
                      onClick={() => handleSubmitAnswer(question.id)}
                    >
                      {isLoading
                        ? "Analyse en cours..."
                        : isEditing
                          ? "Resoumettre"
                          : "Soumettre cette reponse"}
                    </Button>
                    {isEditing && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          setEditing((prev) => {
                            const next = { ...prev };
                            delete next[question.id];
                            return next;
                          })
                        }
                      >
                        Annuler
                      </Button>
                    )}
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
