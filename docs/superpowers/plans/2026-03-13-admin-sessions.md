# Admin Sessions Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an admin sessions area with adoption KPIs, submission table, session detail with answer review, and a prompt iteration drawer.

**Architecture:** Two new admin pages (`/admin/sessions` list + `/admin/sessions/[id]` detail) following the existing client-component pattern. Four new API routes for data fetching and AI re-evaluation. A Sheet drawer for prompt iteration. One DB migration adding a `score` column.

**Tech Stack:** Next.js 16 App Router, Supabase (admin client), shadcn/ui (Sheet, Card, Badge, Table, Button), react-markdown, Zod, Tailwind CSS v4.

**Spec:** `docs/superpowers/specs/2026-03-13-admin-sessions-design.md`

---

## Chunk 1: Foundation (migration, types, schemas, gemini changes)

### Task 1: Database migration — add score column

**Files:**
- Create: `supabase/migrations/003_add_score_column.sql`

- [ ] **Step 1: Create the migration file**

```sql
-- Add score column to answers table
ALTER TABLE answers ADD COLUMN score integer;
```

- [ ] **Step 2: Apply migration locally**

Run: `npx supabase db push` (or apply manually if using remote Supabase)

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/003_add_score_column.sql
git commit -m "feat(db): add score column to answers table"
```

---

### Task 2: Update database interface and types

**Files:**
- Modify: `src/data/interfaces/database.ts`
- Modify: `src/data/interfaces/types.ts`

- [ ] **Step 1: Add `score` to Answer interface**

In `src/data/interfaces/database.ts`, add `score: number | null;` to the `Answer` interface after `is_valid`:

```typescript
export interface Answer {
  id: string;
  submission_id: string;
  question_id: string;
  student_answer: string;
  ai_feedback: string | null;
  is_valid: boolean | null;
  score: number | null;
}
```

- [ ] **Step 2: Add session types**

In `src/data/interfaces/types.ts`, append the new types:

```typescript
export type SessionListItem = {
  id: string;
  student_name: string;
  submitted_at: string;
  subject: { id: string; code: string; question_count: number };
  answer_count: number;
  valid_count: number;
};

export type SessionStats = {
  total_sessions: number;
  unique_students: number;
  completion_rate: number;
  average_score: number;
  today_sessions: number;
};

export type SessionDetail = {
  id: string;
  student_name: string;
  submitted_at: string;
  subject: {
    id: string;
    code: string;
    reference_text: string;
    prompt_id: string | null;
    question_count: number;
  };
  prompt: {
    id: string;
    name: string;
    ai_prompt: string;
    ai_model: string;
    subject_count: number;
  } | null;
  answers: SessionAnswer[];
};

export type SessionAnswer = {
  id: string;
  question: {
    id: string;
    question_text: string;
    display_order: number;
    expected_answer_guidelines: string;
  };
  student_answer: string;
  ai_feedback: string | null;
  score: number | null;
  is_valid: boolean | null;
};

export type ReevalResult = {
  answer_id: string;
  question_text: string;
  ai_feedback: string;
  is_valid: boolean;
  score: number;
};
```

- [ ] **Step 3: Run type check**

Run: `npx tsc --noEmit`
Expected: PASS (no errors)

- [ ] **Step 4: Commit**

```bash
git add src/data/interfaces/database.ts src/data/interfaces/types.ts
git commit -m "feat(types): add session types and score to Answer"
```

---

### Task 3: Zod schemas for session API routes

**Files:**
- Create: `src/lib/schemas/session.ts`

- [ ] **Step 1: Create session schemas**

```typescript
import { z } from "zod";
import { AVAILABLE_MODELS } from "./prompt";

export const reevalSchema = z.object({
  answer_id: z.string().uuid().nullable(),
  prompt_override: z.string().min(1).nullable(),
  model_override: z.enum(AVAILABLE_MODELS).nullable(),
});

export type ReevalData = z.infer<typeof reevalSchema>;

export const savePromptSchema = z.object({
  prompt_text: z.string().min(1, "Le prompt est requis"),
  model: z.enum(AVAILABLE_MODELS),
  test_results: z.array(
    z.object({
      answer_id: z.string().uuid(),
      ai_feedback: z.string(),
      score: z.number().int().min(0).max(100),
      is_valid: z.boolean(),
    })
  ),
});

export type SavePromptData = z.infer<typeof savePromptSchema>;
```

- [ ] **Step 2: Run type check**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/lib/schemas/session.ts
git commit -m "feat(schemas): add Zod schemas for session API routes"
```

---

### Task 4: Extend analyzeAnswer for prompt/model override

**Files:**
- Modify: `src/lib/gemini.ts`
- Modify: `src/app/api/submit/route.ts`

- [ ] **Step 1: Add options parameter to analyzeAnswer**

In `src/lib/gemini.ts`, change the `analyzeAnswer` function signature and body to accept optional overrides. Replace the existing function:

```typescript
export async function analyzeAnswer(
  referenceText: string,
  question: QuestionForAI,
  promptId?: string | null,
  options?: { promptOverride?: string; modelOverride?: string }
): Promise<AIFeedbackItem> {
  let template: string;
  let model: string;

  if (options?.promptOverride) {
    template = options.promptOverride;
    model = options?.modelOverride ?? DEFAULT_MODEL;
  } else {
    const promptConfig = await getPromptForSubject(promptId);
    template = promptConfig.template;
    model = options?.modelOverride ?? promptConfig.model;
  }

  const prompt =
    buildPrompt(template, {
      referenceText,
      questionText: question.question_text,
      expectedAnswerGuidelines: question.expected_answer_guidelines,
      studentAnswer: question.student_answer,
    }) + jsonInstruction(question.question_id);

  const response = await genai.models.generateContent({
    model,
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      temperature: 0,
    },
  });

  const text = response.text ?? "";
  return JSON.parse(text) as AIFeedbackItem;
}
```

- [ ] **Step 2: Update submit route to persist score**

In `src/app/api/submit/route.ts`, add `score` to the answer insert:

```typescript
  const { error: answerError } = await admin.from("answers").insert({
    submission_id: submissionId,
    question_id: parsed.data.question_id,
    student_answer: parsed.data.student_answer,
    ai_feedback: feedback.feedback,
    is_valid: feedback.score >= 50,
    score: feedback.score,
  });
```

- [ ] **Step 3: Run type check**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/lib/gemini.ts src/app/api/submit/route.ts
git commit -m "feat(gemini): add prompt/model override to analyzeAnswer, persist score"
```

---

### Task 5: Add Sheet component from shadcn and nav link

**Files:**
- Create: `src/components/ui/sheet.tsx` (via shadcn CLI)
- Modify: `src/components/admin/admin-shell.tsx`

- [ ] **Step 1: Install Sheet component**

Run: `npx shadcn@latest add sheet`

- [ ] **Step 2: Add Sessions nav link**

In `src/components/admin/admin-shell.tsx`, add a third nav link after "Correcteurs IA":

```typescript
<Link href="/admin/sessions" className="text-muted-foreground hover:text-foreground">
  Sessions
</Link>
```

- [ ] **Step 3: Run type check**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 4: Commit**

Note: `npx shadcn@latest add sheet` may install new dependencies. Include lock file changes.

```bash
git add src/components/ui/sheet.tsx src/components/admin/admin-shell.tsx package.json package-lock.json
git commit -m "feat(ui): add Sheet component and Sessions nav link"
```

---

## Chunk 2: API Routes

### Task 6: GET /api/sessions — list sessions with stats

**Files:**
- Create: `src/app/api/sessions/route.ts`

- [ ] **Step 1: Create the route**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Non autorise" }, { status: 401 });
  }

  const admin = createAdminClient();
  const subjectId = request.nextUrl.searchParams.get("subject_id");

  // Fetch all submissions with subject info
  let query = admin
    .from("submissions")
    .select("id, student_name, submitted_at, subject_id, subjects(id, code, questions(id))")
    .order("submitted_at", { ascending: false });

  if (subjectId) {
    query = query.eq("subject_id", subjectId);
  }

  const { data: submissions, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Fetch answers for all submissions
  const submissionIds = (submissions ?? []).map((s) => s.id);
  const { data: answers } = submissionIds.length > 0
    ? await admin
        .from("answers")
        .select("submission_id, is_valid, score")
        .in("submission_id", submissionIds)
    : { data: [] as { submission_id: string; is_valid: boolean | null; score: number | null }[] };

  const answersMap = new Map<string, { count: number; valid: number; scoreSum: number; scoreCount: number }>();
  for (const a of answers ?? []) {
    const entry = answersMap.get(a.submission_id) ?? { count: 0, valid: 0, scoreSum: 0, scoreCount: 0 };
    entry.count++;
    if (a.is_valid) entry.valid++;
    if (a.score != null) {
      entry.scoreSum += a.score;
      entry.scoreCount++;
    }
    answersMap.set(a.submission_id, entry);
  }

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  const studentNames = new Set<string>();
  let completedCount = 0;
  let totalScoreSum = 0;
  let totalScoreCount = 0;
  let todayCount = 0;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Supabase join types are complex
  const sessions = (submissions ?? []).map((s: any) => {
    const subject = s.subjects as { id: string; code: string; questions: { id: string }[] };
    const questionCount = subject?.questions?.length ?? 0;
    const answerData = answersMap.get(s.id) ?? { count: 0, valid: 0, scoreSum: 0, scoreCount: 0 };

    studentNames.add(s.student_name);
    if (questionCount > 0 && answerData.count >= questionCount) completedCount++;
    totalScoreSum += answerData.scoreSum;
    totalScoreCount += answerData.scoreCount;
    if (s.submitted_at >= todayStart) todayCount++;

    return {
      id: s.id,
      student_name: s.student_name,
      submitted_at: s.submitted_at,
      subject: { id: subject.id, code: subject.code, question_count: questionCount },
      answer_count: answerData.count,
      valid_count: answerData.valid,
    };
  });

  const totalSessions = sessions.length;
  const stats = {
    total_sessions: totalSessions,
    unique_students: studentNames.size,
    completion_rate: totalSessions > 0 ? Math.round((completedCount / totalSessions) * 100) : 0,
    average_score: totalScoreCount > 0 ? Math.round(totalScoreSum / totalScoreCount) : 0,
    today_sessions: todayCount,
  };

  return NextResponse.json({ sessions, stats });
}
```

- [ ] **Step 2: Run type check**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 3: Test manually**

Run: `curl -s http://localhost:3000/api/sessions | head -c 500`
Expected: 401 (not authenticated) — confirms auth guard works

- [ ] **Step 4: Commit**

```bash
git add src/app/api/sessions/route.ts
git commit -m "feat(api): add GET /api/sessions with stats"
```

---

### Task 7: GET /api/sessions/[id] — session detail

**Files:**
- Create: `src/app/api/sessions/[id]/route.ts`

- [ ] **Step 1: Create the route**

```typescript
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Non autorise" }, { status: 401 });
  }

  const admin = createAdminClient();

  // Fetch submission with subject
  const { data: submission, error } = await admin
    .from("submissions")
    .select("id, student_name, submitted_at, subject_id, subjects(id, code, reference_text, prompt_id, questions(id, question_text, display_order, expected_answer_guidelines))")
    .eq("id", id)
    .single();

  if (error || !submission) {
    return NextResponse.json({ error: "Session introuvable" }, { status: 404 });
  }

  const subject = submission.subjects as {
    id: string;
    code: string;
    reference_text: string;
    prompt_id: string | null;
    questions: { id: string; question_text: string; display_order: number; expected_answer_guidelines: string }[];
  };

  // Fetch prompt info if exists
  let promptInfo = null;
  if (subject.prompt_id) {
    const { data: prompt } = await admin
      .from("prompts")
      .select("id, name, ai_prompt, ai_model")
      .eq("id", subject.prompt_id)
      .single();

    if (prompt) {
      // Count how many subjects use this prompt
      const { count } = await admin
        .from("subjects")
        .select("id", { count: "exact", head: true })
        .eq("prompt_id", prompt.id);

      promptInfo = { ...prompt, subject_count: count ?? 1 };
    }
  }

  // Fetch answers for this submission
  const { data: answers } = await admin
    .from("answers")
    .select("id, question_id, student_answer, ai_feedback, score, is_valid")
    .eq("submission_id", id);

  // Build answers with question info
  const questionsMap = new Map(subject.questions.map((q) => [q.id, q]));
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Supabase join types are complex
  const sessionAnswers = (answers ?? [])
    .map((a: any) => {
      const question = questionsMap.get(a.question_id);
      if (!question) return null;
      return {
        id: a.id as string,
        question: {
          id: question.id,
          question_text: question.question_text,
          display_order: question.display_order,
          expected_answer_guidelines: question.expected_answer_guidelines,
        },
        student_answer: a.student_answer as string,
        ai_feedback: a.ai_feedback as string | null,
        score: a.score as number | null,
        is_valid: a.is_valid as boolean | null,
      };
    })
    .filter((a): a is NonNullable<typeof a> => a !== null)
    .sort((a, b) => a.question.display_order - b.question.display_order);

  return NextResponse.json({
    id: submission.id,
    student_name: submission.student_name,
    submitted_at: submission.submitted_at,
    subject: {
      id: subject.id,
      code: subject.code,
      reference_text: subject.reference_text,
      prompt_id: subject.prompt_id,
      question_count: subject.questions.length,
    },
    prompt: promptInfo,
    answers: sessionAnswers,
  });
}
```

- [ ] **Step 2: Run type check**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/app/api/sessions/[id]/route.ts
git commit -m "feat(api): add GET /api/sessions/[id] for session detail"
```

---

### Task 8: POST /api/sessions/[id]/reeval — re-evaluate answers

**Files:**
- Create: `src/app/api/sessions/[id]/reeval/route.ts`

- [ ] **Step 1: Create the route**

```typescript
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { reevalSchema } from "@/lib/schemas/session";
import { analyzeAnswer } from "@/lib/gemini";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Non autorise" }, { status: 401 });
  }

  const body = await request.json();
  const parsed = reevalSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const admin = createAdminClient();
  const { answer_id, prompt_override, model_override } = parsed.data;

  // Fetch submission with subject and questions
  const { data: submission, error: subError } = await admin
    .from("submissions")
    .select("id, subject_id, subjects(id, reference_text, prompt_id, questions(id, question_text, display_order, expected_answer_guidelines))")
    .eq("id", id)
    .single();

  if (subError || !submission) {
    return NextResponse.json({ error: "Session introuvable" }, { status: 404 });
  }

  const subject = submission.subjects as {
    id: string;
    reference_text: string;
    prompt_id: string | null;
    questions: { id: string; question_text: string; display_order: number; expected_answer_guidelines: string }[];
  };

  // Fetch answers to re-evaluate
  let answersQuery = admin
    .from("answers")
    .select("id, question_id, student_answer")
    .eq("submission_id", id);

  if (answer_id) {
    answersQuery = answersQuery.eq("id", answer_id);
  }

  const { data: answers, error: ansError } = await answersQuery;
  if (ansError || !answers?.length) {
    return NextResponse.json({ error: "Aucune reponse trouvee" }, { status: 404 });
  }

  const questionsMap = new Map(subject.questions.map((q) => [q.id, q]));
  const isTestMode = prompt_override != null;

  const results = [];
  for (const answer of answers) {
    const question = questionsMap.get(answer.question_id);
    if (!question) continue;

    try {
      const feedback = await analyzeAnswer(
        subject.reference_text,
        {
          question_id: question.id,
          question_text: question.question_text,
          expected_answer_guidelines: question.expected_answer_guidelines,
          student_answer: answer.student_answer,
        },
        subject.prompt_id,
        prompt_override || model_override
          ? {
              promptOverride: prompt_override ?? undefined,
              modelOverride: model_override ?? undefined,
            }
          : undefined
      );

      const result = {
        answer_id: answer.id,
        question_text: question.question_text,
        ai_feedback: feedback.feedback,
        is_valid: feedback.score >= 50,
        score: feedback.score,
      };

      // Persist only if NOT in test mode
      if (!isTestMode) {
        await admin
          .from("answers")
          .update({
            ai_feedback: feedback.feedback,
            is_valid: feedback.score >= 50,
            score: feedback.score,
          })
          .eq("id", answer.id);
      }

      results.push(result);
    } catch (err) {
      console.error(`Reeval error for answer ${answer.id}:`, err);
      results.push({
        answer_id: answer.id,
        question_text: question.question_text,
        ai_feedback: "Erreur lors de l'evaluation",
        is_valid: false,
        score: 0,
      });
    }
  }

  return NextResponse.json({ results });
}
```

- [ ] **Step 2: Run type check**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/app/api/sessions/[id]/reeval/route.ts
git commit -m "feat(api): add POST /api/sessions/[id]/reeval"
```

---

### Task 9: POST /api/sessions/[id]/save-prompt — save prompt and results

**Files:**
- Create: `src/app/api/sessions/[id]/save-prompt/route.ts`

- [ ] **Step 1: Create the route**

```typescript
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { savePromptSchema } from "@/lib/schemas/session";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Non autorise" }, { status: 401 });
  }

  const body = await request.json();
  const parsed = savePromptSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const admin = createAdminClient();
  const { prompt_text, model, test_results } = parsed.data;

  // Fetch submission to get the subject's prompt_id
  const { data: submission, error: subError } = await admin
    .from("submissions")
    .select("subject_id, subjects(prompt_id)")
    .eq("id", id)
    .single();

  if (subError || !submission) {
    return NextResponse.json({ error: "Session introuvable" }, { status: 404 });
  }

  const subject = submission.subjects as { prompt_id: string | null };

  if (!subject.prompt_id) {
    return NextResponse.json(
      { error: "Aucun correcteur associe a ce sujet" },
      { status: 400 }
    );
  }

  // Update the prompt
  const { error: promptError } = await admin
    .from("prompts")
    .update({ ai_prompt: prompt_text, ai_model: model })
    .eq("id", subject.prompt_id);

  if (promptError) {
    return NextResponse.json(
      { error: "Erreur lors de la mise a jour du correcteur" },
      { status: 500 }
    );
  }

  // Persist test results to answers
  for (const result of test_results) {
    await admin
      .from("answers")
      .update({
        ai_feedback: result.ai_feedback,
        is_valid: result.is_valid,
        score: result.score,
      })
      .eq("id", result.answer_id);
  }

  return NextResponse.json({ success: true });
}
```

- [ ] **Step 2: Run type check**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/app/api/sessions/[id]/save-prompt/route.ts
git commit -m "feat(api): add POST /api/sessions/[id]/save-prompt"
```

---

## Chunk 3: Sessions List Page (UI)

### Task 10: SessionStats component — KPI cards

**Files:**
- Create: `src/components/admin/session-stats.tsx`

- [ ] **Step 1: Create the component**

```typescript
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
```

- [ ] **Step 2: Run type check**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/components/admin/session-stats.tsx
git commit -m "feat(ui): add SessionStats KPI cards component"
```

---

### Task 11: SessionTable component

**Files:**
- Create: `src/components/admin/session-table.tsx`

- [ ] **Step 1: Create the component**

```typescript
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
```

- [ ] **Step 2: Run type check**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/components/admin/session-table.tsx
git commit -m "feat(ui): add SessionTable component"
```

---

### Task 12: Sessions list page

**Files:**
- Create: `src/app/admin/sessions/page.tsx`

- [ ] **Step 1: Create the page**

```typescript
"use client";

import { useEffect, useState, useCallback } from "react";
import { AdminShell } from "@/components/admin/admin-shell";
import { SessionStats } from "@/components/admin/session-stats";
import { SessionTable } from "@/components/admin/session-table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type {
  SessionListItem,
  SessionStats as SessionStatsType,
} from "@/data/interfaces/types";
import type { Subject } from "@/data/interfaces/database";

export default function SessionsPage() {
  const [sessions, setSessions] = useState<SessionListItem[]>([]);
  const [stats, setStats] = useState<SessionStatsType>({
    total_sessions: 0,
    unique_students: 0,
    completion_rate: 0,
    average_score: 0,
    today_sessions: 0,
  });
  const [subjects, setSubjects] = useState<Pick<Subject, "id" | "code">[]>([]);
  const [selectedSubject, setSelectedSubject] = useState<string>("");
  const [loading, setLoading] = useState(true);

  const fetchSubjects = useCallback(async () => {
    const res = await fetch("/api/subjects");
    const data = await res.json();
    setSubjects(data.map((s: Subject & { questions: unknown[] }) => ({ id: s.id, code: s.code })));
  }, []);

  const fetchSessions = useCallback(async (subjectId?: string) => {
    setLoading(true);
    const url = subjectId
      ? `/api/sessions?subject_id=${subjectId}`
      : "/api/sessions";
    const res = await fetch(url);
    const data = await res.json();
    setSessions(data.sessions);
    setStats(data.stats);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchSubjects();
    fetchSessions();
  }, [fetchSubjects, fetchSessions]);

  function handleSubjectChange(value: string) {
    setSelectedSubject(value);
    fetchSessions(value || undefined);
  }

  return (
    <AdminShell>
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Sessions eleves</h1>

        {/* Filtre par sujet */}
        <div>
          <select
            value={selectedSubject}
            onChange={(e) => handleSubjectChange(e.target.value)}
            className="rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="">Tous les sujets</option>
            {subjects.map((s) => (
              <option key={s.id} value={s.id}>
                {s.code}
              </option>
            ))}
          </select>
        </div>

        {/* KPI */}
        <SessionStats stats={stats} />

        {/* Tableau */}
        <Card>
          <CardHeader>
            <CardTitle>Liste des sessions</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-center text-muted-foreground py-8">
                Chargement...
              </p>
            ) : (
              <SessionTable sessions={sessions} />
            )}
          </CardContent>
        </Card>
      </div>
    </AdminShell>
  );
}
```

- [ ] **Step 2: Run dev server and verify**

Run: `npm run dev`
Navigate to: `http://localhost:3000/admin/sessions`
Expected: Page renders with KPI cards (all zeros if no data), empty table message, subject filter dropdown

- [ ] **Step 3: Run type check**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/app/admin/sessions/page.tsx
git commit -m "feat(admin): add sessions list page with KPIs and filters"
```

---

## Chunk 4: Session Detail Page + Drawer

### Task 13: AnswerCard component

**Files:**
- Create: `src/components/admin/answer-card.tsx`

- [ ] **Step 1: Create the component**

```typescript
"use client";

import { useState } from "react";
import ReactMarkdown from "react-markdown";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import type { SessionAnswer } from "@/data/interfaces/types";

interface AnswerCardProps {
  answer: SessionAnswer;
  sessionId: string;
  onUpdated: (answerId: string, feedback: string, score: number, isValid: boolean) => void;
}

export function AnswerCard({ answer, sessionId, onUpdated }: AnswerCardProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleReeval() {
    setLoading(true);
    setError("");

    try {
      const res = await fetch(`/api/sessions/${sessionId}/reeval`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          answer_id: answer.id,
          prompt_override: null,
          model_override: null,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error?.toString() || "Erreur lors de la reevaluation");
        return;
      }

      const data = await res.json();
      const result = data.results[0];
      if (result) {
        onUpdated(answer.id, result.ai_feedback, result.score, result.is_valid);
      }
    } catch {
      setError("Erreur lors de la reevaluation");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <div>
          <span className="text-sm text-muted-foreground">
            Question {answer.question.display_order}
          </span>
          <h3 className="font-semibold mt-1">{answer.question.question_text}</h3>
        </div>
        <div className="flex items-center gap-2">
          {answer.score != null && (
            <Badge className={answer.score >= 50 ? "bg-green-600" : "bg-red-600"}>
              {answer.score}/100
            </Badge>
          )}
          {answer.is_valid != null && (
            <Badge variant={answer.is_valid ? "default" : "destructive"}>
              {answer.is_valid ? "Validee" : "Non validee"}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">
            Reponse de l&apos;eleve
          </p>
          <div className="bg-muted rounded-md p-3 text-sm leading-relaxed">
            {answer.student_answer}
          </div>
        </div>

        {answer.ai_feedback && (
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">
              Feedback IA
            </p>
            <div
              className={`rounded-md p-3 text-sm leading-relaxed border ${
                answer.is_valid
                  ? "bg-green-50 border-green-200 dark:bg-green-950 dark:border-green-800"
                  : "bg-red-50 border-red-200 dark:bg-red-950 dark:border-red-800"
              }`}
            >
              <div className="prose prose-sm max-w-none">
                <ReactMarkdown>{answer.ai_feedback}</ReactMarkdown>
              </div>
            </div>
          </div>
        )}

        <div className="flex items-center justify-end gap-2">
          {error && <p className="text-sm text-red-600">{error}</p>}
          <Button
            variant="outline"
            size="sm"
            onClick={handleReeval}
            disabled={loading}
          >
            {loading ? "Evaluation en cours..." : "Relancer l'evaluation IA"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 2: Run type check**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/components/admin/answer-card.tsx
git commit -m "feat(ui): add AnswerCard component with reeval button"
```

---

### Task 14: PromptDrawer component

**Files:**
- Create: `src/components/admin/prompt-drawer.tsx`

- [ ] **Step 1: Create the component**

```typescript
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
```

- [ ] **Step 2: Run type check**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/components/admin/prompt-drawer.tsx
git commit -m "feat(ui): add PromptDrawer component for prompt iteration"
```

---

### Task 15: SessionDetail component

**Files:**
- Create: `src/components/admin/session-detail.tsx`

- [ ] **Step 1: Create the component**

```typescript
"use client";

import { useState, useCallback, useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AnswerCard } from "./answer-card";
import { PromptDrawer } from "./prompt-drawer";
import type { SessionDetail as SessionDetailType, SessionAnswer } from "@/data/interfaces/types";

interface SessionDetailProps {
  sessionId: string;
}

export function SessionDetail({ sessionId }: SessionDetailProps) {
  const [session, setSession] = useState<SessionDetailType | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [drawerOpen, setDrawerOpen] = useState(false);

  const fetchSession = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/sessions/${sessionId}`);
      if (!res.ok) {
        setError("Session introuvable");
        return;
      }
      const data = await res.json();
      setSession(data);
    } catch {
      setError("Erreur de chargement");
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  useEffect(() => {
    fetchSession();
  }, [fetchSession]);

  function handleAnswerUpdated(
    answerId: string,
    feedback: string,
    score: number,
    isValid: boolean
  ) {
    if (!session) return;
    setSession({
      ...session,
      answers: session.answers.map((a: SessionAnswer) =>
        a.id === answerId
          ? { ...a, ai_feedback: feedback, score, is_valid: isValid }
          : a
      ),
    });
  }

  if (loading) {
    return (
      <p className="text-center text-muted-foreground py-8">Chargement...</p>
    );
  }

  if (error || !session) {
    return (
      <div className="text-center py-8">
        <p className="text-red-600 mb-4">{error || "Session introuvable"}</p>
        <Button variant="outline" onClick={fetchSession}>
          Reessayer
        </Button>
      </div>
    );
  }

  const validCount = session.answers.filter(
    (a: SessionAnswer) => a.is_valid
  ).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <Link
          href="/admin/sessions"
          className="text-sm text-primary hover:underline"
        >
          ← Retour aux sessions
        </Link>
        {session.prompt && (
          <Button onClick={() => setDrawerOpen(true)}>
            Modifier le prompt
          </Button>
        )}
      </div>

      {/* Session info */}
      <div className="flex items-center justify-between rounded-lg border p-6">
        <div>
          <h2 className="text-xl font-bold">{session.student_name}</h2>
          <div className="flex items-center gap-3 mt-2 text-muted-foreground">
            <Badge variant="secondary">{session.subject.code}</Badge>
            <span>
              {new Date(session.submitted_at).toLocaleDateString("fr-FR", {
                day: "numeric",
                month: "long",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
          </div>
        </div>
        <div className="text-center">
          <div className="text-3xl font-bold text-green-600">
            {validCount}/{session.subject.question_count}
          </div>
          <div className="text-sm text-muted-foreground">
            questions validees
          </div>
        </div>
      </div>

      {/* Answer cards */}
      {session.answers.length === 0 ? (
        <p className="text-center text-muted-foreground py-8">
          Cet eleve n&apos;a pas encore soumis de reponse
        </p>
      ) : (
        session.answers.map((answer: SessionAnswer) => (
          <AnswerCard
            key={answer.id}
            answer={answer}
            sessionId={sessionId}
            onUpdated={handleAnswerUpdated}
          />
        ))
      )}

      {/* Prompt drawer — key forces remount when prompt changes so useState resets */}
      {session.prompt && (
        <PromptDrawer
          key={session.prompt.ai_prompt + session.prompt.ai_model}
          open={drawerOpen}
          onOpenChange={setDrawerOpen}
          sessionId={sessionId}
          initialPrompt={session.prompt.ai_prompt}
          initialModel={session.prompt.ai_model}
          promptName={session.prompt.name}
          subjectCount={session.prompt.subject_count}
          onSaved={fetchSession}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 2: Run type check**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/components/admin/session-detail.tsx
git commit -m "feat(ui): add SessionDetail component"
```

---

### Task 16: Session detail page

**Files:**
- Create: `src/app/admin/sessions/[id]/page.tsx`

- [ ] **Step 1: Create the page**

```typescript
"use client";

import { useParams } from "next/navigation";
import { AdminShell } from "@/components/admin/admin-shell";
import { SessionDetail } from "@/components/admin/session-detail";

export default function SessionDetailPage() {
  const params = useParams<{ id: string }>();

  return (
    <AdminShell>
      <SessionDetail sessionId={params.id} />
    </AdminShell>
  );
}
```

- [ ] **Step 2: Run type check**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 3: Verify in browser**

Run: `npm run dev`
Navigate to: `http://localhost:3000/admin/sessions` then click "Voir" on a session
Expected: Detail page renders with answer cards, feedback, and "Modifier le prompt" button

- [ ] **Step 4: Commit**

```bash
git add src/app/admin/sessions/[id]/page.tsx
git commit -m "feat(admin): add session detail page"
```

---

## Chunk 5: Final verification

### Task 17: Full build and verification

- [ ] **Step 1: Run type check**

Run: `npx tsc --noEmit`
Expected: PASS (zero errors)

- [ ] **Step 2: Run production build**

Run: `npm run build`
Expected: Build succeeds with no errors

- [ ] **Step 3: Manual smoke test**

1. Navigate to `http://localhost:3000/admin/sessions`
   - Verify KPI cards display
   - Verify subject filter works
   - Verify table shows sessions (or empty state)
2. Click "Voir" on a session
   - Verify answer cards render with feedback
   - Click "Relancer l'evaluation IA" on an answer — verify spinner then updated card
3. Click "Modifier le prompt"
   - Verify drawer opens with current prompt
   - Modify prompt text, click "Tester sur cette session"
   - Verify results appear in drawer
   - Click "Sauvegarder le prompt sur le sujet"
   - Verify drawer closes and page refreshes

- [ ] **Step 4: Final commit (if any adjustments)**

```bash
git add -A
git commit -m "fix: adjustments from smoke test"
```
