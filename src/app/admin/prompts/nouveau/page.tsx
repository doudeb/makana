import { AdminShell } from "@/components/admin/admin-shell";
import { PromptForm } from "@/components/admin/prompt-form";

export default function NewPromptPage() {
  return (
    <AdminShell>
      <div className="max-w-3xl mx-auto space-y-6">
        <h1 className="text-2xl font-bold">Nouveau correcteur</h1>
        <PromptForm />
      </div>
    </AdminShell>
  );
}
