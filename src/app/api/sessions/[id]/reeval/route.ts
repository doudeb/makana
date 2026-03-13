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

  // Supabase returns the join as an object or array — handle both
  const rawSubject = submission.subjects;
  const subject = (Array.isArray(rawSubject) ? rawSubject[0] : rawSubject) as {
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

  // Deduplicate: keep only the latest answer per question_id
  const dedupMap = new Map<string, (typeof answers)[number]>();
  for (const a of answers) {
    dedupMap.set(a.question_id, a);
  }
  const dedupedAnswers = answer_id ? answers : Array.from(dedupMap.values());

  const questionsMap = new Map(subject.questions.map((q) => [q.id, q]));
  const isTestMode = prompt_override != null;

  const results = [];
  for (const answer of dedupedAnswers) {
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
