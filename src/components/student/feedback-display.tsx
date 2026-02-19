"use client";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { AnswerFeedback } from "@/data/interfaces/types";
import type { Question } from "@/data/interfaces/database";

interface FeedbackDisplayProps {
  feedbacks: AnswerFeedback[];
  questions: Question[];
}

export function FeedbackDisplay({
  feedbacks,
  questions,
}: FeedbackDisplayProps) {
  const sorted = [...questions].sort(
    (a, b) => a.display_order - b.display_order
  );

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold">Resultats de la correction</h2>
      {sorted.map((question) => {
        const fb = feedbacks.find((f) => f.question_id === question.id);
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
            <CardContent>
              {fb ? (
                <p className="text-sm whitespace-pre-wrap">{fb.feedback}</p>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Pas de retour disponible
                </p>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
