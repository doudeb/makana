"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AdminShell } from "@/components/admin/admin-shell";
import { PromptTable } from "@/components/admin/prompt-table";
import type { Prompt } from "@/data/interfaces/database";

export default function PromptsPage() {
  const [prompts, setPrompts] = useState<
    Pick<Prompt, "id" | "name" | "ai_model" | "updated_at">[]
  >([]);
  const [loading, setLoading] = useState(true);

  const fetchPrompts = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/prompts");
    const data = await res.json();
    setPrompts(data);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchPrompts();
  }, [fetchPrompts]);

  return (
    <AdminShell>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Correcteurs IA</h1>
          <Link href="/admin/prompts/nouveau">
            <Button>Nouveau correcteur</Button>
          </Link>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Liste des correcteurs</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-center text-muted-foreground py-8">
                Chargement...
              </p>
            ) : (
              <PromptTable prompts={prompts} onRefresh={fetchPrompts} />
            )}
          </CardContent>
        </Card>
      </div>
    </AdminShell>
  );
}
