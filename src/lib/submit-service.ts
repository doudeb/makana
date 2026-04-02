import { createAdminClient } from "@/lib/supabase/admin";
import { analyzeAnswer } from "@/lib/gemini";
import { VALID_SCORE_THRESHOLD } from "@/lib/constants";
import type { SingleAnswerData } from "@/lib/schemas/student";

interface SubmitResult {
  submission_id: string;
  question_id: string;
  score: number | null;
  feedback: string;
}

/**
 * Shared logic for processing a single answer submission.
 * Used by both /api/submit and /api/submit-stream.
 */
export async function processSubmission(
  data: SingleAnswerData
): Promise<SubmitResult> {
  const admin = createAdminClient();

  // Fetch subject with questions
  const { data: subject, error: subjectError } = await admin
    .from("subjects")
    .select("*, questions(*)")
    .eq("id", data.subject_id)
    .single();

  if (subjectError || !subject) {
    throw new SubmitError("Sujet introuvable", 404);
  }

  // Find the question
  const question = subject.questions.find(
    (q: { id: string }) => q.id === data.question_id
  );
  if (!question) {
    throw new SubmitError("Question introuvable", 404);
  }

  // Reuse existing submission or create a new one
  let submissionId: string | undefined = data.submission_id;

  if (!submissionId) {
    const { data: existing } = await admin
      .from("submissions")
      .select("id")
      .eq("subject_id", data.subject_id)
      .eq("student_name", data.student_name)
      .order("submitted_at", { ascending: false })
      .limit(1)
      .single();

    if (existing) {
      submissionId = existing.id;
      await admin
        .from("submissions")
        .update({ submitted_at: new Date().toISOString() })
        .eq("id", submissionId);
    } else {
      const { data: submission, error: submissionError } = await admin
        .from("submissions")
        .insert({
          subject_id: data.subject_id,
          student_name: data.student_name,
        })
        .select()
        .single();

      if (submissionError || !submission) {
        throw new SubmitError("Erreur lors de la soumission", 500);
      }
      submissionId = submission.id;
    }
  }

  if (!submissionId) {
    throw new SubmitError("Erreur lors de la soumission", 500);
  }

  // Call Gemini AI
  let feedback;
  try {
    feedback = await analyzeAnswer(
      subject.reference_text,
      {
        question_id: data.question_id,
        question_text: question.question_text,
        expected_answer_guidelines: question.expected_answer_guidelines,
        student_answer: data.student_answer,
      },
      subject.prompt_id
    );
  } catch (err) {
    console.error("Gemini error:", err);
    await admin.from("answers").insert({
      submission_id: submissionId,
      question_id: data.question_id,
      student_answer: data.student_answer,
      ai_feedback: "L'analyse IA est temporairement indisponible.",
      is_valid: null,
    });

    return {
      submission_id: submissionId,
      question_id: data.question_id,
      score: null,
      feedback: "L'analyse IA est temporairement indisponible.",
    };
  }

  // Save the answer with AI feedback
  const { error: answerError } = await admin.from("answers").insert({
    submission_id: submissionId,
    question_id: data.question_id,
    student_answer: data.student_answer,
    ai_feedback: feedback.feedback,
    is_valid: feedback.score >= VALID_SCORE_THRESHOLD,
    score: feedback.score,
  });

  if (answerError) {
    throw new SubmitError("Erreur lors de l'enregistrement", 500);
  }

  return {
    submission_id: submissionId,
    question_id: feedback.question_id,
    score: feedback.score,
    feedback: feedback.feedback,
  };
}

export class SubmitError extends Error {
  constructor(
    message: string,
    public status: number
  ) {
    super(message);
    this.name = "SubmitError";
  }
}
