import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { promptTestSchema } from "@/lib/schemas/prompt";
import { runTestEvaluation } from "@/lib/gemini";

export async function POST(request: Request) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Non autorise" }, { status: 401 });
  }

  const body = await request.json();
  const parsed = promptTestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten() },
      { status: 400 }
    );
  }

  try {
    const result = await runTestEvaluation(parsed.data);
    return NextResponse.json(result);
  } catch (err) {
    console.error("Prompt test error:", err);
    return NextResponse.json(
      { error: "Erreur lors du test du prompt" },
      { status: 500 }
    );
  }
}
