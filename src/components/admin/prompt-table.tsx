"use client";

import { useRouter } from "next/navigation";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DeleteDialog } from "./delete-dialog";
import type { Prompt } from "@/data/interfaces/database";

interface PromptTableProps {
  prompts: Pick<Prompt, "id" | "name" | "ai_model" | "updated_at">[];
  onRefresh: () => void;
}

export function PromptTable({ prompts, onRefresh }: PromptTableProps) {
  const router = useRouter();

  async function handleDelete(id: string) {
    const res = await fetch(`/api/prompts/${id}`, { method: "DELETE" });
    if (!res.ok) {
      const data = await res.json();
      alert(data.error || "Erreur lors de la suppression");
      return;
    }
    onRefresh();
  }

  if (prompts.length === 0) {
    return (
      <p className="text-center text-muted-foreground py-8">
        Aucun correcteur pour le moment. Creez-en un !
      </p>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Nom</TableHead>
          <TableHead>Modele</TableHead>
          <TableHead>Derniere modification</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {prompts.map((prompt) => (
          <TableRow key={prompt.id}>
            <TableCell className="font-medium">{prompt.name}</TableCell>
            <TableCell>
              <Badge variant="secondary" className="font-mono">
                {prompt.ai_model}
              </Badge>
            </TableCell>
            <TableCell>
              {new Date(prompt.updated_at).toLocaleDateString("fr-FR")}
            </TableCell>
            <TableCell className="text-right space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => router.push(`/admin/prompts/${prompt.id}`)}
              >
                Modifier
              </Button>
              <DeleteDialog
                subjectCode={prompt.name}
                onConfirm={() => handleDelete(prompt.id)}
              />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
