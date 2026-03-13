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

  // Supabase returns the join as an object (many-to-one) or array — handle both
  const rawSubject = submission.subjects;
  const subject = (Array.isArray(rawSubject) ? rawSubject[0] : rawSubject) as {
    id: string;
    code: string;
    reference_text: string;
    prompt_id: string | null;
    questions: { id: string; question_text: string; display_order: number; expected_answer_guidelines: string }[];
  };

  // Fetch prompt info if exists
  let promptInfo = null;
  if (subject?.prompt_id) {
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

  // Fetch answers for this submission — fallback if score column doesn't exist yet
  let answerRows: { id: string; question_id: string; student_answer: string; ai_feedback: string | null; score: number | null; is_valid: boolean | null }[] = [];
  const { data: answers, error: ansErr } = await admin
    .from("answers")
    .select("id, question_id, student_answer, ai_feedback, score, is_valid")
    .eq("submission_id", id);

  if (ansErr) {
    const { data: fallbackData } = await admin
      .from("answers")
      .select("id, question_id, student_answer, ai_feedback, is_valid")
      .eq("submission_id", id);
    answerRows = (fallbackData ?? []).map((a: any) => ({ ...a, score: null }));
  } else {
    answerRows = answers ?? [];
  }

  // Deduplicate: keep only the latest answer per question_id
  // PostgreSQL returns rows in insertion order, so last one wins
  const dedupMap = new Map<string, (typeof answerRows)[number]>();
  for (const a of answerRows) {
    dedupMap.set(a.question_id, a);
  }
  const dedupedAnswers = Array.from(dedupMap.values());

  // Build answers with question info
  const questionsMap = new Map(subject.questions.map((q) => [q.id, q]));
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Supabase join types are complex
  const sessionAnswers = (dedupedAnswers)
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
