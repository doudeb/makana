import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Non autorise" }, { status: 401 });
  }

  const admin = createAdminClient();
  const subjectId = request.nextUrl.searchParams.get("subject_id");

  // Fetch all submissions with subject info
  let query = admin
    .from("submissions")
    .select("id, student_name, submitted_at, subject_id, subjects(id, code, questions(id))")
    .order("submitted_at", { ascending: false });

  if (subjectId) {
    query = query.eq("subject_id", subjectId);
  }

  const { data: submissions, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Fetch answers for all submissions
  const submissionIds = (submissions ?? []).map((s) => s.id);
  let answerRows: { submission_id: string; is_valid: boolean | null; score: number | null }[] = [];
  if (submissionIds.length > 0) {
    // Try with score column first, fallback without if column doesn't exist yet
    const { data, error: ansErr } = await admin
      .from("answers")
      .select("submission_id, is_valid, score")
      .in("submission_id", submissionIds);

    if (ansErr) {
      // score column may not exist yet — retry without it
      const { data: fallbackData } = await admin
        .from("answers")
        .select("submission_id, is_valid")
        .in("submission_id", submissionIds);
      answerRows = (fallbackData ?? []).map((a) => ({ ...a, score: null }));
    } else {
      answerRows = data ?? [];
    }
  }

  const answersMap = new Map<string, { count: number; valid: number; scoreSum: number; scoreCount: number }>();
  for (const a of answerRows) {
    const entry = answersMap.get(a.submission_id) ?? { count: 0, valid: 0, scoreSum: 0, scoreCount: 0 };
    entry.count++;
    if (a.is_valid) entry.valid++;
    if (a.score != null) {
      entry.scoreSum += a.score;
      entry.scoreCount++;
    }
    answersMap.set(a.submission_id, entry);
  }

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  const studentNames = new Set<string>();
  let completedCount = 0;
  let totalScoreSum = 0;
  let totalScoreCount = 0;
  let todayCount = 0;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Supabase join types are complex
  const sessions = (submissions ?? []).map((s: any) => {
    const subject = s.subjects as { id: string; code: string; questions: { id: string }[] };
    const questionCount = subject?.questions?.length ?? 0;
    const answerData = answersMap.get(s.id) ?? { count: 0, valid: 0, scoreSum: 0, scoreCount: 0 };

    studentNames.add(s.student_name);
    if (questionCount > 0 && answerData.count >= questionCount) completedCount++;
    totalScoreSum += answerData.scoreSum;
    totalScoreCount += answerData.scoreCount;
    if (s.submitted_at >= todayStart) todayCount++;

    return {
      id: s.id,
      student_name: s.student_name,
      submitted_at: s.submitted_at,
      subject: { id: subject.id, code: subject.code, question_count: questionCount },
      answer_count: answerData.count,
      valid_count: answerData.valid,
    };
  });

  const totalSessions = sessions.length;
  const stats = {
    total_sessions: totalSessions,
    unique_students: studentNames.size,
    completion_rate: totalSessions > 0 ? Math.round((completedCount / totalSessions) * 100) : 0,
    average_score: totalScoreCount > 0 ? Math.round(totalScoreSum / totalScoreCount) : 0,
    today_sessions: todayCount,
  };

  return NextResponse.json({ sessions, stats });
}
