"use client";

import { useState } from "react";
import ReactMarkdown from "react-markdown";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import type { SessionAnswer } from "@/data/interfaces/types";

interface AnswerCardProps {
  answer: SessionAnswer;
  sessionId: string;
  onUpdated: (answerId: string, feedback: string, score: number, isValid: boolean) => void;
}

export function AnswerCard({ answer, sessionId, onUpdated }: AnswerCardProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleReeval() {
    setLoading(true);
    setError("");

    try {
      const res = await fetch(`/api/sessions/${sessionId}/reeval`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          answer_id: answer.id,
          prompt_override: null,
          model_override: null,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error?.toString() || "Erreur lors de la reevaluation");
        return;
      }

      const data = await res.json();
      const result = data.results[0];
      if (result) {
        onUpdated(answer.id, result.ai_feedback, result.score, result.is_valid);
      }
    } catch {
      setError("Erreur lors de la reevaluation");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">
              Question {answer.question.display_order}
            </span>
            {answer.created_at && (
              <span className="text-xs text-muted-foreground">
                {new Date(answer.created_at).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                {answer.updated_at && answer.updated_at !== answer.created_at && " (modifiee)"}
              </span>
            )}
          </div>
          <h3 className="font-semibold mt-1">{answer.question.question_text}</h3>
        </div>
        <div className="flex items-center gap-2">
          {answer.score != null && (
            <Badge className={answer.score >= 50 ? "bg-green-600" : "bg-red-600"}>
              {answer.score}/100
            </Badge>
          )}
          {answer.is_valid != null && (
            <Badge variant={answer.is_valid ? "default" : "destructive"}>
              {answer.is_valid ? "Validee" : "Non validee"}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">
            Reponse de l&apos;eleve
          </p>
          <div className="bg-muted rounded-md p-3 text-sm leading-relaxed">
            {answer.student_answer}
          </div>
        </div>

        {answer.ai_feedback && (
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">
              Feedback IA
            </p>
            <div
              className={`rounded-md p-3 text-sm leading-relaxed border ${
                answer.is_valid
                  ? "bg-green-50 border-green-200 dark:bg-green-950 dark:border-green-800"
                  : "bg-red-50 border-red-200 dark:bg-red-950 dark:border-red-800"
              }`}
            >
              <div className="prose prose-sm max-w-none">
                <ReactMarkdown>{answer.ai_feedback}</ReactMarkdown>
              </div>
            </div>
          </div>
        )}

        <div className="flex items-center justify-end gap-2">
          {error && <p className="text-sm text-red-600">{error}</p>}
          <Button
            variant="outline"
            size="sm"
            onClick={handleReeval}
            disabled={loading}
          >
            {loading ? "Evaluation en cours..." : "Relancer l'evaluation IA"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
