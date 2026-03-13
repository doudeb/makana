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

  // Cast Supabase join — may need `as unknown as ...` if TS complains
  const subject = submission.subjects as unknown as { prompt_id: string | null };

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
