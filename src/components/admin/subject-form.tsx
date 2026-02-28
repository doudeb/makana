"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { subjectFormSchema, type SubjectFormData } from "@/lib/schemas/subject";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Wysiwyg } from "@/components/ui/wysiwyg";

interface PromptOption {
  id: string;
  name: string;
  ai_model: string;
}

interface SubjectFormProps {
  initialData?: SubjectFormData & { id?: string };
}

export function SubjectForm({ initialData }: SubjectFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [pdfError, setPdfError] = useState("");
  const [error, setError] = useState("");
  const [prompts, setPrompts] = useState<PromptOption[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch("/api/prompts")
      .then((res) => res.json())
      .then((data) => setPrompts(data))
      .catch(() => {});
  }, []);

  const isEditing = !!initialData?.id;

  const {
    register,
    handleSubmit,
    control,
    setValue,
    formState: { errors },
  } = useForm<SubjectFormData>({
    resolver: zodResolver(subjectFormSchema),
    defaultValues: initialData ?? {
      reference_text: "",
      questions: [
        { question_text: "", expected_answer_guidelines: "" },
        { question_text: "", expected_answer_guidelines: "" },
        { question_text: "", expected_answer_guidelines: "" },
        { question_text: "", expected_answer_guidelines: "" },
      ],
    },
  });

  async function handlePdfUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type !== "application/pdf") {
      setPdfError("Veuillez selectionner un fichier PDF");
      return;
    }

    setPdfLoading(true);
    setPdfError("");

    try {
      const body = new FormData();
      body.append("file", file);
      const res = await fetch("/api/pdf-extract", { method: "POST", body });
      const data = await res.json();

      if (!res.ok) {
        setPdfError(data.error || "Erreur lors de la lecture du PDF");
        return;
      }

      setValue("reference_text", data.text as string, { shouldValidate: true });
    } catch {
      setPdfError("Erreur lors de la lecture du PDF");
    } finally {
      setPdfLoading(false);
      // Reset file input so the same file can be re-selected
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function onSubmit(data: SubjectFormData) {
    setLoading(true);
    setError("");

    const url = isEditing
      ? `/api/subjects/${initialData!.id}`
      : "/api/subjects";
    const method = isEditing ? "PUT" : "POST";

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

    if (!res.ok) {
      const err = await res.json();
      setError(err.error?.toString() || "Une erreur est survenue");
      setLoading(false);
      return;
    }

    router.push("/admin");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Correcteur IA</CardTitle>
        </CardHeader>
        <CardContent>
          <select
            {...register("prompt_id")}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="">Correcteur par defaut</option>
            {prompts.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} ({p.ai_model})
              </option>
            ))}
          </select>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Texte de reference</CardTitle>
            <div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf"
                onChange={handlePdfUpload}
                className="hidden"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={pdfLoading}
                onClick={() => fileInputRef.current?.click()}
              >
                {pdfLoading ? "Extraction..." : "Importer un PDF"}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Controller
            name="reference_text"
            control={control}
            render={({ field }) => (
              <Wysiwyg
                content={field.value}
                onChange={field.onChange}
                placeholder="Collez ici le texte de reference du sujet..."
              />
            )}
          />
          {(errors.reference_text || pdfError) && (
            <p className="text-sm text-red-600 mt-1">
              {pdfError || errors.reference_text?.message}
            </p>
          )}
        </CardContent>
      </Card>

      {[0, 1, 2, 3].map((i) => (
        <Card key={i}>
          <CardHeader>
            <CardTitle>Question {i + 1}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Enonce de la question</Label>
              <Input
                {...register(`questions.${i}.question_text`)}
                placeholder={`Question ${i + 1}`}
              />
              {errors.questions?.[i]?.question_text && (
                <p className="text-sm text-red-600">
                  {errors.questions[i].question_text.message}
                </p>
              )}
            </div>
            <Separator />
            <div className="space-y-2">
              <Label>Indications de reponse attendue</Label>
              <Textarea
                {...register(`questions.${i}.expected_answer_guidelines`)}
                rows={8}
                placeholder="Elements de reponse attendus pour guider l'IA..."
              />
              {errors.questions?.[i]?.expected_answer_guidelines && (
                <p className="text-sm text-red-600">
                  {errors.questions[i].expected_answer_guidelines.message}
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      ))}

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex gap-4">
        <Button type="submit" disabled={loading}>
          {loading
            ? "Enregistrement..."
            : isEditing
              ? "Mettre a jour"
              : "Creer le sujet"}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => router.push("/admin")}
        >
          Annuler
        </Button>
      </div>
    </form>
  );
}
