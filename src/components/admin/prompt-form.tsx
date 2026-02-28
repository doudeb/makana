"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  promptFormSchema,
  type PromptFormData,
  AVAILABLE_MODELS,
} from "@/lib/schemas/prompt";
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
import { Badge } from "@/components/ui/badge";

interface PromptFormProps {
  initialData?: PromptFormData & { id?: string };
  onPromptChange?: (prompt: string) => void;
  onModelChange?: (model: string) => void;
}

const PLACEHOLDER_VARS = [
  "{{referenceText}}",
  "{{questionText}}",
  "{{expectedAnswerGuidelines}}",
  "{{studentAnswer}}",
];

export function PromptForm({
  initialData,
  onPromptChange,
  onModelChange,
}: PromptFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const isEditing = !!initialData?.id;

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<PromptFormData>({
    resolver: zodResolver(promptFormSchema),
    defaultValues: initialData ?? {
      name: "",
      ai_prompt: "",
      ai_model: "gemini-2.5-flash",
    },
  });

  async function onSubmit(data: PromptFormData) {
    setLoading(true);
    setError("");

    const url = isEditing
      ? `/api/prompts/${initialData!.id}`
      : "/api/prompts";
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

    if (isEditing) {
      router.refresh();
      setLoading(false);
    } else {
      const created = await res.json();
      router.push(`/admin/prompts/${created.id}`);
      router.refresh();
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Nom du correcteur</CardTitle>
        </CardHeader>
        <CardContent>
          <Input
            {...register("name")}
            placeholder='Ex: "Droit", "Economie", "Correcteur par defaut"'
          />
          {errors.name && (
            <p className="text-sm text-red-600 mt-1">{errors.name.message}</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Modele IA</CardTitle>
        </CardHeader>
        <CardContent>
          <select
            {...register("ai_model", {
              onChange: (e) => onModelChange?.(e.target.value),
            })}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            {AVAILABLE_MODELS.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
          {errors.ai_model && (
            <p className="text-sm text-red-600 mt-1">
              {errors.ai_model.message}
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Prompt systeme</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {PLACEHOLDER_VARS.map((v) => (
              <Badge key={v} variant="secondary" className="font-mono text-xs">
                {v}
              </Badge>
            ))}
          </div>
          <Textarea
            {...register("ai_prompt", {
              onChange: (e) => onPromptChange?.(e.target.value),
            })}
            rows={20}
            className="font-mono text-sm"
            placeholder="Ecrivez votre prompt ici en utilisant les variables ci-dessus..."
          />
          {errors.ai_prompt && (
            <p className="text-sm text-red-600 mt-1">
              {errors.ai_prompt.message}
            </p>
          )}
          <p className="text-xs text-muted-foreground">
            L&apos;instruction JSON est ajoutee automatiquement a la fin du
            prompt.
          </p>
        </CardContent>
      </Card>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex gap-4">
        <Button type="submit" disabled={loading}>
          {loading
            ? "Enregistrement..."
            : isEditing
              ? "Enregistrer"
              : "Creer le correcteur"}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => router.push("/admin/prompts")}
        >
          Annuler
        </Button>
      </div>
    </form>
  );
}
