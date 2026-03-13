"use client";

import { Card, CardContent } from "@/components/ui/card";
import type { SessionStats as SessionStatsType } from "@/data/interfaces/types";

interface SessionStatsProps {
  stats: SessionStatsType;
}

export function SessionStats({ stats }: SessionStatsProps) {
  const cards = [
    { label: "Total sessions", value: stats.total_sessions, color: "text-primary" },
    { label: "Eleves uniques", value: stats.unique_students, color: "text-primary" },
    { label: "Taux de completion", value: `${stats.completion_rate}%`, color: "text-green-600" },
    { label: "Score moyen", value: `${stats.average_score}%`, color: "text-orange-500" },
    { label: "Aujourd'hui", value: stats.today_sessions, color: "text-primary" },
  ];

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
      {cards.map((card) => (
        <Card key={card.label}>
          <CardContent className="pt-6 text-center">
            <div className={`text-3xl font-bold ${card.color}`}>{card.value}</div>
            <div className="text-sm text-muted-foreground mt-1">{card.label}</div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
