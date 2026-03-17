"use client";

import { useState, useCallback, useRef } from "react";
import confetti from "canvas-confetti";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import ReactMarkdown from "react-markdown";
import { useSubmitStream } from "@/hooks/use-submit-stream";
import type { Question } from "@/data/interfaces/database";
import type { AnswerFeedback } from "@/data/interfaces/types";

interface AnswerFormProps {
  subjectId: string;
  studentName: string;
  questions: Question[];
}

function fireSmallConfetti() {
  confetti({
    particleCount: 80,
    spread: 60,
    origin: { y: 0.7 },
  });
}

function fireMassiveConfetti() {
  const duration = 3000;
  const end = Date.now() + duration;

  (function frame() {
    confetti({
      particleCount: 30,
      angle: 60,
      spread: 55,
      origin: { x: 0 },
    });
    confetti({
      particleCount: 30,
      angle: 120,
      spread: 55,
      origin: { x: 1 },
    });
    if (Date.now() < end) {
      requestAnimationFrame(frame);
    }
  })();
}

function scoreBadge(score: number) {
  if (score > 80) return { className: "bg-green-600 text-white", label: `${score}%` };
  if (score > 50) return { className: "bg-orange-500 text-white", label: `${score}%` };
  return { className: "bg-red-600 text-white", label: `${score}%` };
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
  const [statusMessage, setStatusMessage] = useState<Record<string, string>>(
    {}
  );
  const [feedbacks, setFeedbacks] = useState<Record<string, AnswerFeedback>>(
    {}
  );
  const [submissionId, setSubmissionId] = useState<string | null>(null);
  const [editing, setEditing] = useState<Record<string, boolean>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Refs to access latest state in callbacks without re-creating them
  const feedbacksRef = useRef(feedbacks);
  feedbacksRef.current = feedbacks;
  const submissionIdRef = useRef(submissionId);
  submissionIdRef.current = submissionId;
  const loadingQuestionRef = useRef(loadingQuestion);
  loadingQuestionRef.current = loadingQuestion;

  const callbacks = useCallback(
    () => ({
      onStatus: (stage: string, message: string) => {
        const qid = loadingQuestionRef.current;
        if (qid) {
          setStatusMessage((prev) => ({ ...prev, [qid]: message }));
        }
      },
      onResult: (result: {
        submission_id: string;
        question_id: string;
        score: number | null;
        feedback: string;
      }) => {
        if (!submissionIdRef.current) {
          setSubmissionId(result.submission_id);
        }

        const nextFeedbacks = {
          ...feedbacksRef.current,
          [result.question_id]: {
            question_id: result.question_id,
            score: result.score,
            feedback: result.feedback,
          } as AnswerFeedback,
        };
        setFeedbacks(nextFeedbacks);
        setEditing((prev) => {
          const next = { ...prev };
          delete next[result.question_id];
          return next;
        });
        setLoadingQuestion(null);
        setStatusMessage((prev) => {
          const next = { ...prev };
          delete next[result.question_id];
          return next;
        });

        if (result.score !== null && result.score >= 82) {
          const allPerfect =
            questions.length > 1 &&
            questions.every((q) => (q.id in nextFeedbacks) && nextFeedbacks[q.id]?.score !== null && nextFeedbacks[q.id].score >= 82);
          if (allPerfect) {
            fireMassiveConfetti();
          } else {
            fireSmallConfetti();
          }
        }
      },
      onError: (message: string) => {
        const qid = loadingQuestionRef.current;
        if (qid) {
          setErrors((prev) => ({ ...prev, [qid]: message }));
          setLoadingQuestion(null);
          setStatusMessage((prev) => {
            const next = { ...prev };
            delete next[qid];
            return next;
          });
        }
      },
    }),
    [questions]
  );

  const { submit } = useSubmitStream(callbacks());

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

    await submit({
      subject_id: subjectId,
      student_name: studentName,
      submission_id: submissionIdRef.current ?? undefined,
      question_id: questionId,
      student_answer: answer,
    });
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
                {fb && fb.score !== null && (
                  <Badge className={scoreBadge(fb.score).className}>
                    {scoreBadge(fb.score).label}
                  </Badge>
                )}
              </div>
              <p className="text-sm text-muted-foreground">
                {question.question_text}
              </p>
            </CardHeader>
            <CardContent className="space-y-3">
              {isLoading && statusMessage[question.id] && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground animate-pulse">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {statusMessage[question.id]}
                </div>
              )}
              {fb && !isEditing && (
                <div className="rounded-md bg-muted p-4 prose prose-sm max-w-none [&>p]:my-1.5 [&>p:first-child]:mt-0 [&>p:last-child]:mb-0">
                  <ReactMarkdown>{fb.feedback}</ReactMarkdown>
                </div>
              )}
              {fb && !isEditing && (
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
                        ? "Envoi en cours..."
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
