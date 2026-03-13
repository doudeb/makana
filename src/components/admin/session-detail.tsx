"use client";

import { useState, useCallback, useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AnswerCard } from "./answer-card";
import { PromptDrawer } from "./prompt-drawer";
import type { SessionDetail as SessionDetailType, SessionAnswer } from "@/data/interfaces/types";

interface SessionDetailProps {
  sessionId: string;
}

export function SessionDetail({ sessionId }: SessionDetailProps) {
  const [session, setSession] = useState<SessionDetailType | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [drawerOpen, setDrawerOpen] = useState(false);

  const fetchSession = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/sessions/${sessionId}`);
      if (!res.ok) {
        setError("Session introuvable");
        return;
      }
      const data = await res.json();
      setSession(data);
    } catch {
      setError("Erreur de chargement");
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  useEffect(() => {
    fetchSession();
  }, [fetchSession]);

  function handleAnswerUpdated(
    answerId: string,
    feedback: string,
    score: number,
    isValid: boolean
  ) {
    if (!session) return;
    setSession({
      ...session,
      answers: session.answers.map((a: SessionAnswer) =>
        a.id === answerId
          ? { ...a, ai_feedback: feedback, score, is_valid: isValid }
          : a
      ),
    });
  }

  if (loading) {
    return (
      <p className="text-center text-muted-foreground py-8">Chargement...</p>
    );
  }

  if (error || !session) {
    return (
      <div className="text-center py-8">
        <p className="text-red-600 mb-4">{error || "Session introuvable"}</p>
        <Button variant="outline" onClick={fetchSession}>
          Reessayer
        </Button>
      </div>
    );
  }

  const validCount = session.answers.filter(
    (a: SessionAnswer) => a.is_valid
  ).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <Link
          href="/admin/sessions"
          className="text-sm text-primary hover:underline"
        >
          ← Retour aux sessions
        </Link>
        {session.prompt && (
          <Button onClick={() => setDrawerOpen(true)}>
            Modifier le prompt
          </Button>
        )}
      </div>

      {/* Session info */}
      <div className="flex items-center justify-between rounded-lg border p-6">
        <div>
          <h2 className="text-xl font-bold">{session.student_name}</h2>
          <div className="flex items-center gap-3 mt-2 text-muted-foreground">
            <Badge variant="secondary">{session.subject.code}</Badge>
            <span>
              {new Date(session.submitted_at).toLocaleDateString("fr-FR", {
                day: "numeric",
                month: "long",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
          </div>
        </div>
        <div className="text-center">
          <div className="text-3xl font-bold text-green-600">
            {validCount}/{session.subject.question_count}
          </div>
          <div className="text-sm text-muted-foreground">
            questions validees
          </div>
        </div>
      </div>

      {/* Answer cards */}
      {session.answers.length === 0 ? (
        <p className="text-center text-muted-foreground py-8">
          Cet eleve n&apos;a pas encore soumis de reponse
        </p>
      ) : (
        session.answers.map((answer: SessionAnswer) => (
          <AnswerCard
            key={answer.id}
            answer={answer}
            sessionId={sessionId}
            onUpdated={handleAnswerUpdated}
          />
        ))
      )}

      {/* Prompt drawer — key forces remount when prompt changes so useState resets */}
      {session.prompt && (
        <PromptDrawer
          key={session.prompt.ai_prompt + session.prompt.ai_model}
          open={drawerOpen}
          onOpenChange={setDrawerOpen}
          sessionId={sessionId}
          initialPrompt={session.prompt.ai_prompt}
          initialModel={session.prompt.ai_model}
          promptName={session.prompt.name}
          subjectCount={session.prompt.subject_count}
          onSaved={fetchSession}
        />
      )}
    </div>
  );
}
