import { AdminShell } from "@/components/admin/admin-shell";
import { SubjectForm } from "@/components/admin/subject-form";

export default function NewSubjectPage() {
  return (
    <AdminShell>
      <div className="max-w-3xl mx-auto space-y-6">
        <h1 className="text-2xl font-bold">Nouveau sujet</h1>
        <SubjectForm />
      </div>
    </AdminShell>
  );
}
