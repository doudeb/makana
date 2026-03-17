import { createAdminClient } from "@/lib/supabase/admin";
import { singleAnswerSchema } from "@/lib/schemas/student";
import { analyzeAnswer } from "@/lib/gemini";

export async function POST(request: Request) {
  const body = await request.json();
  const parsed = singleAnswerSchema.safeParse(body);

  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const encoder = new TextEncoder();

  function send(event: string, data: unknown): Uint8Array {
    return encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  }

  const stream = new ReadableStream({
    async start(controller) {
      try {
        controller.enqueue(
          send("status", { stage: "received", message: "Reponse recue..." })
        );

        const admin = createAdminClient();

        // Fetch subject with questions
        const { data: subject, error: subjectError } = await admin
          .from("subjects")
          .select("*, questions(*)")
          .eq("id", parsed.data.subject_id)
          .single();

        if (subjectError || !subject) {
          controller.enqueue(
            send("error", { message: "Sujet introuvable" })
          );
          controller.close();
          return;
        }

        // Find the question
        const question = subject.questions.find(
          (q: { id: string }) => q.id === parsed.data.question_id
        );
        if (!question) {
          controller.enqueue(
            send("error", { message: "Question introuvable" })
          );
          controller.close();
          return;
        }

        // Reuse existing submission or create a new one
        let submissionId = parsed.data.submission_id;

        if (!submissionId) {
          const { data: existing } = await admin
            .from("submissions")
            .select("id")
            .eq("subject_id", parsed.data.subject_id)
            .eq("student_name", parsed.data.student_name)
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
                subject_id: parsed.data.subject_id,
                student_name: parsed.data.student_name,
              })
              .select()
              .single();

            if (submissionError || !submission) {
              controller.enqueue(
                send("error", { message: "Erreur lors de la soumission" })
              );
              controller.close();
              return;
            }
            submissionId = submission.id;
          }
        }

        controller.enqueue(
          send("status", {
            stage: "analyzing",
            message: "L'IA analyse ta reponse...",
          })
        );

        // Call Gemini AI
        let feedback;
        try {
          feedback = await analyzeAnswer(
            subject.reference_text,
            {
              question_id: parsed.data.question_id,
              question_text: question.question_text,
              expected_answer_guidelines: question.expected_answer_guidelines,
              student_answer: parsed.data.student_answer,
            },
            subject.prompt_id
          );
        } catch (err) {
          console.error("Gemini error:", err);
          await admin.from("answers").insert({
            submission_id: submissionId,
            question_id: parsed.data.question_id,
            student_answer: parsed.data.student_answer,
            ai_feedback: "L'analyse IA est temporairement indisponible.",
            is_valid: null,
          });

          controller.enqueue(
            send("result", {
              submission_id: submissionId,
              question_id: parsed.data.question_id,
              score: null,
              feedback: "L'analyse IA est temporairement indisponible.",
            })
          );
          controller.close();
          return;
        }

        // Save the answer
        const { error: answerError } = await admin.from("answers").insert({
          submission_id: submissionId,
          question_id: parsed.data.question_id,
          student_answer: parsed.data.student_answer,
          ai_feedback: feedback.feedback,
          is_valid: feedback.score >= 50,
          score: feedback.score,
        });

        if (answerError) {
          controller.enqueue(
            send("error", { message: "Erreur lors de l'enregistrement" })
          );
          controller.close();
          return;
        }

        controller.enqueue(
          send("result", {
            submission_id: submissionId,
            question_id: feedback.question_id,
            score: feedback.score,
            feedback: feedback.feedback,
          })
        );
        controller.close();
      } catch (err) {
        console.error("Stream error:", err);
        controller.enqueue(
          send("error", { message: "Une erreur inattendue est survenue" })
        );
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
