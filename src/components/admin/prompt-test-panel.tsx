"use client";

import { useState } from "react";
import ReactMarkdown from "react-markdown";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface PromptTestPanelProps {
  prompt: string;
  model: string;
}

function scoreBadge(score: number) {
  if (score >= 70) return <Badge className="bg-green-600">{score}%</Badge>;
  if (score >= 30) return <Badge className="bg-orange-500">{score}%</Badge>;
  return <Badge className="bg-red-600">{score}%</Badge>;
}

export function PromptTestPanel({ prompt, model }: PromptTestPanelProps) {
  const [referenceText, setReferenceText] = useState("");
  const [questionText, setQuestionText] = useState("");
  const [expectedAnswerGuidelines, setExpectedAnswerGuidelines] = useState("");
  const [studentAnswer, setStudentAnswer] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{
    score: number;
    feedback: string;
  } | null>(null);
  const [error, setError] = useState("");

  async function handleTest() {
    setLoading(true);
    setError("");
    setResult(null);

    try {
      const res = await fetch("/api/prompt-test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ai_prompt: prompt,
          ai_model: model,
          reference_text: referenceText,
          question_text: questionText,
          expected_answer_guidelines: expectedAnswerGuidelines,
          student_answer: studentAnswer,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error?.toString() || "Erreur lors du test");
        return;
      }

      const data = await res.json();
      setResult({ score: data.score, feedback: data.feedback });
    } catch {
      setError("Erreur lors du test");
    } finally {
      setLoading(false);
    }
  }

  const canTest =
    prompt && referenceText && questionText && expectedAnswerGuidelines && studentAnswer;

  return (
    <Card className="border-orange-300">
      <CardHeader>
        <CardTitle className="text-orange-600">Zone de test</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label>Texte de reference</Label>
          <Textarea
            value={referenceText}
            onChange={(e) => setReferenceText(e.target.value)}
            rows={4}
            placeholder="Collez un extrait de texte de reference..."
          />
        </div>

        <div className="space-y-2">
          <Label>Question</Label>
          <Textarea
            value={questionText}
            onChange={(e) => setQuestionText(e.target.value)}
            rows={2}
            placeholder="Ex: Identifiez les parties au contrat..."
          />
        </div>

        <div className="space-y-2">
          <Label>Indications de reponse attendue</Label>
          <Textarea
            value={expectedAnswerGuidelines}
            onChange={(e) => setExpectedAnswerGuidelines(e.target.value)}
            rows={3}
            placeholder="Elements de reponse attendus..."
          />
        </div>

        <div className="space-y-2">
          <Label>Reponse de l&apos;eleve</Label>
          <Textarea
            value={studentAnswer}
            onChange={(e) => setStudentAnswer(e.target.value)}
            rows={3}
            placeholder="La reponse a evaluer..."
          />
        </div>

        <Button
          type="button"
          onClick={handleTest}
          disabled={loading || !canTest}
          className="w-full"
        >
          {loading ? "Evaluation en cours..." : "Tester le prompt"}
        </Button>

        {error && <p className="text-sm text-red-600">{error}</p>}

        {result && (
          <div className="rounded-md border p-4 space-y-3">
            <div className="flex items-center gap-2">
              <span className="font-medium">Score :</span>
              {scoreBadge(result.score)}
            </div>
            <div className="prose prose-sm max-w-none">
              <ReactMarkdown>{result.feedback}</ReactMarkdown>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
