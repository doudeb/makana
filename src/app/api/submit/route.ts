import { NextResponse } from "next/server";
import { singleAnswerSchema } from "@/lib/schemas/student";
import { processSubmission, SubmitError } from "@/lib/submit-service";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Corps de requete JSON invalide" },
      { status: 400 }
    );
  }

  const parsed = singleAnswerSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten() },
      { status: 400 }
    );
  }

  try {
    const result = await processSubmission(parsed.data);
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof SubmitError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("Submit error:", err);
    return NextResponse.json(
      { error: "Une erreur inattendue est survenue" },
      { status: 500 }
    );
  }
}
