import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";

const genai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file || file.type !== "application/pdf") {
      return NextResponse.json(
        { error: "Fichier PDF requis" },
        { status: 400 }
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString("base64");

    const response = await genai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [
        {
          role: "user",
          parts: [
            {
              inlineData: {
                mimeType: "application/pdf",
                data: base64,
              },
            },
            {
              text: `Extrais tout le texte de ce document PDF et retourne-le en HTML simple pour un editeur WYSIWYG.

REGLES :
- Utilise uniquement ces balises : <h2>, <h3>, <p>, <strong>, <em>, <u>, <ul>, <ol>, <li>
- Conserve fidèlement la structure du document : titres, sous-titres, paragraphes, listes
- Mets en <strong> les mots ou passages en gras dans le document original
- Mets en <em> les mots ou passages en italique dans le document original
- Ne modifie AUCUN mot du texte original
- Pas de commentaire, pas d'introduction, pas de balises <html>, <body> ou <head>
- Retourne directement le HTML, sans bloc de code markdown`,
            },
          ],
        },
      ],
    });

    const text = response.text?.trim() ?? "";

    if (!text) {
      return NextResponse.json(
        { error: "Aucun texte extractible dans ce PDF" },
        { status: 422 }
      );
    }

    return NextResponse.json({ text });
  } catch {
    return NextResponse.json(
      { error: "Erreur lors de la lecture du PDF" },
      { status: 500 }
    );
  }
}
