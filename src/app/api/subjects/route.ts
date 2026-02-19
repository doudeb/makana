import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { subjectFormSchema } from "@/lib/schemas/subject";
import { generateUniqueCode } from "@/lib/code-generator";

export async function GET() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("subjects")
    .select("*, questions(*)")
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

export async function POST(request: Request) {
  const supabase = await createClient();

  // Check auth
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

  // Generate unique code with retry
  let code = generateUniqueCode();
  let attempts = 0;
  while (attempts < 10) {
    const { data: existing } = await admin
      .from("subjects")
      .select("id")
      .eq("code", code)
      .single();
    if (!existing) break;
    code = generateUniqueCode();
    attempts++;
  }

  // Insert subject
  const { data: subject, error: subjectError } = await admin
    .from("subjects")
    .insert({ reference_text: parsed.data.reference_text, code })
    .select()
    .single();

  if (subjectError) {
    return NextResponse.json(
      { error: subjectError.message },
      { status: 500 }
    );
  }

  // Insert questions
  const questions = parsed.data.questions.map((q, i) => ({
    subject_id: subject.id,
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

  return NextResponse.json(subject, { status: 201 });
}
