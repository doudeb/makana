"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { AdminShell } from "@/components/admin/admin-shell";
import { PromptForm } from "@/components/admin/prompt-form";
import { PromptTestPanel } from "@/components/admin/prompt-test-panel";
import type { PromptFormData } from "@/lib/schemas/prompt";
import type { Prompt } from "@/data/interfaces/database";

export default function EditPromptPage() {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<(PromptFormData & { id: string }) | null>(
    null
  );
  const [loading, setLoading] = useState(true);
  const [livePrompt, setLivePrompt] = useState("");
  const [liveModel, setLiveModel] = useState("");

  const load = useCallback(async () => {
    const res = await fetch(`/api/prompts/${id}`);
    const prompt: Prompt = await res.json();
    setData({
      id: prompt.id,
      name: prompt.name,
      ai_prompt: prompt.ai_prompt,
      ai_model: prompt.ai_model as PromptFormData["ai_model"],
    });
    setLivePrompt(prompt.ai_prompt);
    setLiveModel(prompt.ai_model);
    setLoading(false);
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return (
      <AdminShell>
        <p className="text-center text-muted-foreground py-8">Chargement...</p>
      </AdminShell>
    );
  }

  if (!data) {
    return (
      <AdminShell>
        <p className="text-center text-red-600 py-8">
          Correcteur introuvable
        </p>
      </AdminShell>
    );
  }

  return (
    <AdminShell>
      <div className="max-w-3xl mx-auto space-y-6">
        <h1 className="text-2xl font-bold">Modifier le correcteur</h1>
        <PromptForm
          initialData={data}
          onPromptChange={setLivePrompt}
          onModelChange={setLiveModel}
        />
        <PromptTestPanel prompt={livePrompt} model={liveModel} />
      </div>
    </AdminShell>
  );
}
