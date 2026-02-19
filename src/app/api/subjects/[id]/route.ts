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

  const body = await request.json();
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
    .update({ reference_text: parsed.data.reference_text })
    .eq("id", id);

  if (subjectError) {
    return NextResponse.json(
      { error: subjectError.message },
      { status: 500 }
    );
  }

  // Delete old questions and re-insert
  await admin.from("questions").delete().eq("subject_id", id);

  const questions = parsed.data.questions.map((q, i) => ({
    subject_id: id,
    question_text: q.question_text,
    display_order: i + 1,
    expected_answer_guidelines: q.expected_answer_guidelines,
  }));

  const { error: questionsError } = await admin
    .from("questions")
    .insert(questions);

  if (questionsError) {
    return NextResponse.json(
      { error: questionsError.message },
      { status: 500 }
    );
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
