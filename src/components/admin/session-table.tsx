"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { SessionListItem } from "@/data/interfaces/types";

interface SessionTableProps {
  sessions: SessionListItem[];
}

function scoreBadge(valid: number, total: number) {
  if (total === 0) return <span className="text-muted-foreground">-</span>;
  const ratio = valid / total;
  const className =
    ratio >= 0.75
      ? "bg-green-600"
      : ratio >= 0.5
        ? "bg-orange-500"
        : "bg-red-600";
  return <Badge className={className}>{valid}/{total}</Badge>;
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function SessionTable({ sessions }: SessionTableProps) {
  if (sessions.length === 0) {
    return (
      <p className="text-center text-muted-foreground py-8">
        Aucune session pour le moment
      </p>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Eleve</TableHead>
          <TableHead>Sujet</TableHead>
          <TableHead>Reponses</TableHead>
          <TableHead>Score</TableHead>
          <TableHead>Date</TableHead>
          <TableHead></TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {sessions.map((session) => (
          <TableRow key={session.id}>
            <TableCell className="font-medium">{session.student_name}</TableCell>
            <TableCell>
              <Badge variant="secondary">{session.subject.code}</Badge>
            </TableCell>
            <TableCell>
              {session.answer_count}/{session.subject.question_count}
            </TableCell>
            <TableCell>
              {scoreBadge(session.valid_count, session.answer_count)}
            </TableCell>
            <TableCell className="text-muted-foreground">
              {formatDate(session.submitted_at)}
            </TableCell>
            <TableCell>
              <Link
                href={`/admin/sessions/${session.id}`}
                className="text-primary hover:underline text-sm"
              >
                Voir →
              </Link>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
