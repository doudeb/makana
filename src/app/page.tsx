"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function HomePage() {
  const [code, setCode] = useState("");
  const [studentName, setStudentName] = useState("");
  const [error, setError] = useState("");
  const router = useRouter();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!code.trim() || !studentName.trim()) {
      setError("Veuillez remplir tous les champs");
      return;
    }

    const params = new URLSearchParams({ prenom: studentName.trim() });
    router.push(`/sujet/${code.trim().toLowerCase()}?${params.toString()}`);
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Makana</CardTitle>
          <CardDescription>
            Entrez le code du sujet et votre prenom pour commencer
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="code">Code du sujet</Label>
              <Input
                id="code"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="ex: pomme-soleil-42"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="prenom">Votre prenom</Label>
              <Input
                id="prenom"
                value={studentName}
                onChange={(e) => setStudentName(e.target.value)}
                placeholder="ex: Marie"
                required
              />
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <Button type="submit" className="w-full">
              Acceder au sujet
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
