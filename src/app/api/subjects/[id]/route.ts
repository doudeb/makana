import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { subjectFormSchema } from "@/lib/schemas/subject";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("subjects")
    .select("*, questions(*)")
    .eq("id", id)
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 404 });
  }

  return NextResponse.json(data);
}

export async function PUT(
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

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Corps de requete JSON invalide" }, { status: 400 });
  }
  const parsed = subjectFormSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const admin = createAdminClient();

  // Update subject
  const { error: subjectError } = await admin
    .from("subjects")
    .update({
      reference_text: parsed.data.reference_text,
      prompt_id: parsed.data.prompt_id || null,
    })
    .eq("id", id);

  if (subjectError) {
    return NextResponse.json(
      { error: subjectError.message },
      { status: 500 }
    );
  }

  // Fetch existing questions to update in-place (preserves IDs and avoids cascade-deleting answers)
  const { data: existingQuestions } = await admin
    .from("questions")
    .select("id, display_order")
    .eq("subject_id", id)
    .order("display_order");

  const existingByOrder = new Map(
    (existingQuestions ?? []).map((q) => [q.display_order, q.id])
  );

  for (let i = 0; i < parsed.data.questions.length; i++) {
    const q = parsed.data.questions[i];
    const order = i + 1;
    const existingId = existingByOrder.get(order);

    if (existingId) {
      // Update existing question in-place
      await admin
        .from("questions")
        .update({
          question_text: q.question_text,
          expected_answer_guidelines: q.expected_answer_guidelines,
        })
        .eq("id", existingId);
      existingByOrder.delete(order);
    } else {
      // Insert new question
      await admin.from("questions").insert({
        subject_id: id,
        question_text: q.question_text,
        display_order: order,
        expected_answer_guidelines: q.expected_answer_guidelines,
      });
    }
  }

  // Delete questions that no longer exist (e.g. if question count was reduced)
  const remainingIds = Array.from(existingByOrder.values());
  if (remainingIds.length > 0) {
    await admin.from("questions").delete().in("id", remainingIds);
  }

  return NextResponse.json({ success: true });
}

export async function DELETE(
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
  const { error } = await admin.from("subjects").delete().eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
