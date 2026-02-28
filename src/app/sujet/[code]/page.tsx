import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SubjectView } from "@/components/student/subject-view";

interface PageProps {
  params: Promise<{ code: string }>;
  searchParams: Promise<{ prenom?: string }>;
}

export default async function SubjectPage({ params, searchParams }: PageProps) {
  const { code } = await params;
  const { prenom } = await searchParams;

  if (!prenom) {
    redirect("/");
  }

  const supabase = await createClient();

  const { data: subject, error } = await supabase
    .from("subjects")
    .select("*, questions(*)")
    .eq("code", code)
    .single();

  if (error || !subject) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center space-y-4">
          <h1 className="text-2xl font-bold">Sujet introuvable</h1>
          <p className="text-muted-foreground">
            Le code <strong>{code}</strong> ne correspond a aucun sujet.
            Verifiez le code et reessayez.
          </p>
          <a href="/" className="text-primary underline">
            Retour a l&apos;accueil
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-3xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Sujet</h1>
          <p className="text-muted-foreground">
            Bienvenue {prenom} ! Lisez attentivement le texte puis repondez
            aux questions.
          </p>
        </div>

        <div className="rounded-xl border bg-card text-card-foreground shadow">
          <div className="flex flex-col space-y-1.5 p-6">
            <h2 className="font-semibold leading-none tracking-tight">
              Texte de reference
            </h2>
          </div>
          <div className="p-6 pt-0">
            <div
              className="prose prose-sm max-w-none"
              dangerouslySetInnerHTML={{ __html: subject.reference_text }}
            />
          </div>
        </div>

        <hr className="shrink-0 bg-border h-[1px] w-full" />

        <SubjectView subject={subject} studentName={prenom} />
      </div>
    </div>
  );
}
