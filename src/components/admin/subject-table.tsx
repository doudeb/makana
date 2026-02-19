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
import type { SubjectWithQuestions } from "@/data/interfaces/types";

interface SubjectTableProps {
  subjects: SubjectWithQuestions[];
  onRefresh: () => void;
}

export function SubjectTable({ subjects, onRefresh }: SubjectTableProps) {
  const router = useRouter();

  async function handleDelete(id: string) {
    await fetch(`/api/subjects/${id}`, { method: "DELETE" });
    onRefresh();
  }

  if (subjects.length === 0) {
    return (
      <p className="text-center text-muted-foreground py-8">
        Aucun sujet pour le moment. Creez-en un !
      </p>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Code</TableHead>
          <TableHead>Texte de reference</TableHead>
          <TableHead>Questions</TableHead>
          <TableHead>Date de creation</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {subjects.map((subject) => (
          <TableRow key={subject.id}>
            <TableCell>
              <Badge variant="secondary" className="font-mono">
                {subject.code}
              </Badge>
            </TableCell>
            <TableCell className="max-w-xs truncate">
              {subject.reference_text.substring(0, 80)}...
            </TableCell>
            <TableCell>{subject.questions.length}</TableCell>
            <TableCell>
              {new Date(subject.created_at).toLocaleDateString("fr-FR")}
            </TableCell>
            <TableCell className="text-right space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => router.push(`/admin/sujets/${subject.id}`)}
              >
                Modifier
              </Button>
              <DeleteDialog
                subjectCode={subject.code}
                onConfirm={() => handleDelete(subject.id)}
              />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
