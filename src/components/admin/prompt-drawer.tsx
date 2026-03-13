"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { AVAILABLE_MODELS } from "@/lib/schemas/prompt";
import type { ReevalResult } from "@/data/interfaces/types";

interface PromptDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sessionId: string;
  initialPrompt: string;
  initialModel: string;
  promptName: string;
  subjectCount: number;
  onSaved: () => void;
}

export function PromptDrawer({
  open,
  onOpenChange,
  sessionId,
  initialPrompt,
  initialModel,
  promptName,
  subjectCount,
  onSaved,
}: PromptDrawerProps) {
  const [promptText, setPromptText] = useState(initialPrompt);
  const [model, setModel] = useState(initialModel);
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testResults, setTestResults] = useState<ReevalResult[] | null>(null);
  const [error, setError] = useState("");

  async function handleTest() {
    setTesting(true);
    setError("");
    setTestResults(null);

    try {
      const res = await fetch(`/api/sessions/${sessionId}/reeval`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          answer_id: null,
          prompt_override: promptText,
          model_override: model,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error?.toString() || "Erreur lors du test");
        return;
      }

      const data = await res.json();
      setTestResults(data.results);
    } catch {
      setError("Erreur lors du test");
    } finally {
      setTesting(false);
    }
  }

  async function handleSave() {
    if (!testResults) return;
    setSaving(true);
    setError("");

    try {
      const res = await fetch(`/api/sessions/${sessionId}/save-prompt`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt_text: promptText,
          model,
          test_results: testResults.map((r) => ({
            answer_id: r.answer_id,
            ai_feedback: r.ai_feedback,
            score: r.score,
            is_valid: r.is_valid,
          })),
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error?.toString() || "Erreur lors de la sauvegarde");
        return;
      }

      onSaved();
      onOpenChange(false);
    } catch {
      setError("Erreur lors de la sauvegarde");
    } finally {
      setSaving(false);
    }
  }

  const validCount = testResults?.filter((r) => r.is_valid).length ?? 0;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-[540px] sm:max-w-[540px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Modifier le prompt</SheetTitle>
          <p className="text-sm text-muted-foreground">{promptName}</p>
        </SheetHeader>

        <div className="space-y-6 mt-6">
          {subjectCount > 1 && (
            <Alert variant="destructive">
              <AlertDescription>
                Ce correcteur est utilise par {subjectCount} sujets. La
                modification affectera tous ces sujets.
              </AlertDescription>
            </Alert>
          )}

          {/* Model selector */}
          <div className="space-y-2">
            <Label>Modele IA</Label>
            <select
              value={model}
              onChange={(e) => setModel(e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              {AVAILABLE_MODELS.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>

          {/* Prompt textarea */}
          <div className="space-y-2">
            <Label>Prompt systeme</Label>
            <Textarea
              value={promptText}
              onChange={(e) => {
                setPromptText(e.target.value);
                setTestResults(null);
              }}
              rows={12}
              className="font-mono text-xs"
            />
          </div>

          {/* Test button */}
          <Button
            onClick={handleTest}
            disabled={testing || !promptText}
            className="w-full"
          >
            {testing ? "Evaluation en cours..." : "Tester sur cette session"}
          </Button>
          <p className="text-xs text-muted-foreground">
            Relance l&apos;evaluation IA sur toutes les reponses sans sauvegarder
          </p>

          {error && <p className="text-sm text-red-600">{error}</p>}

          {/* Test results */}
          {testResults && (
            <>
              <div className="border-t pt-4">
                <p className="text-xs text-muted-foreground uppercase tracking-wide mb-3">
                  Resultats du test
                </p>
                <div className="space-y-2">
                  {testResults.map((r) => (
                    <div key={r.answer_id} className="bg-muted rounded-md p-3">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium truncate mr-2">
                          {r.question_text}
                        </span>
                        <Badge
                          className={
                            r.score >= 50 ? "bg-green-600" : "bg-red-600"
                          }
                        >
                          {r.score}/100
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground line-clamp-2">
                        {r.ai_feedback}
                      </p>
                    </div>
                  ))}
                </div>
                <p className="text-center text-sm text-muted-foreground mt-3">
                  Score global :{" "}
                  <strong>
                    {validCount}/{testResults.length} validees
                  </strong>{" "}
                  (seuil : 50/100)
                </p>
              </div>

              {/* Save button */}
              <div className="border-t pt-4">
                <Button
                  onClick={handleSave}
                  disabled={saving}
                  className="w-full bg-green-600 hover:bg-green-700"
                >
                  {saving
                    ? "Sauvegarde en cours..."
                    : "Sauvegarder le prompt sur le sujet"}
                </Button>
                <p className="text-xs text-muted-foreground mt-2">
                  Met a jour le correcteur et conserve les evaluations actuelles
                </p>
              </div>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
