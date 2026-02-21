import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { singleAnswerSchema } from "@/lib/schemas/student";
import { analyzeAnswer } from "@/lib/gemini";

export async function POST(request: Request) {
  const body = await request.json();
  const parsed = singleAnswerSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const admin = createAdminClient();

  // Fetch subject with questions
  const { data: subject, error: subjectError } = await admin
    .from("subjects")
    .select("*, questions(*)")
    .eq("id", parsed.data.subject_id)
    .single();

  if (subjectError || !subject) {
    return NextResponse.json({ error: "Sujet introuvable" }, { status: 404 });
  }

  // Find the question
  const question = subject.questions.find(
    (q: { id: string }) => q.id === parsed.data.question_id
  );
  if (!question) {
    return NextResponse.json(
      { error: "Question introuvable" },
      { status: 404 }
    );
  }

  // Reuse existing submission or create a new one
  let submissionId = parsed.data.submission_id;

  if (!submissionId) {
    const { data: submission, error: submissionError } = await admin
      .from("submissions")
      .insert({
        subject_id: parsed.data.subject_id,
        student_name: parsed.data.student_name,
      })
      .select()
      .single();

    if (submissionError || !submission) {
      return NextResponse.json(
        { error: "Erreur lors de la soumission" },
        { status: 500 }
      );
    }
    submissionId = submission.id;
  }

  // Call Gemini AI for this single answer
  let feedback;
  try {
    feedback = await analyzeAnswer(subject.reference_text, {
      question_id: parsed.data.question_id,
      question_text: question.question_text,
      expected_answer_guidelines: question.expected_answer_guidelines,
      student_answer: parsed.data.student_answer,
    });
  } catch (err) {
    console.error("Gemini error:", err);
    await admin.from("answers").insert({
      submission_id: submissionId,
      question_id: parsed.data.question_id,
      student_answer: parsed.data.student_answer,
      ai_feedback: "L'analyse IA est temporairement indisponible.",
      is_valid: null,
    });

    return NextResponse.json({
      submission_id: submissionId,
      question_id: parsed.data.question_id,
      score: null,
      feedback: "L'analyse IA est temporairement indisponible.",
    });
  }

  // Save the answer with AI feedback
  const { error: answerError } = await admin.from("answers").insert({
    submission_id: submissionId,
    question_id: parsed.data.question_id,
    student_answer: parsed.data.student_answer,
    ai_feedback: feedback.feedback,
    is_valid: feedback.score >= 50,
  });

  if (answerError) {
    return NextResponse.json(
      { error: "Erreur lors de l'enregistrement" },
      { status: 500 }
    );
  }

  return NextResponse.json({
    submission_id: submissionId,
    question_id: feedback.question_id,
    score: feedback.score,
    feedback: feedback.feedback,
  });
}
