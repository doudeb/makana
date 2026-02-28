import { join } from "path";
import { NextRequest, NextResponse } from "next/server";
import {
  getDocument,
  GlobalWorkerOptions,
} from "pdfjs-dist/legacy/build/pdf.mjs";

GlobalWorkerOptions.workerSrc = join(
  process.cwd(),
  "node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs"
);

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
    const pdf = await getDocument({
      data: new Uint8Array(arrayBuffer),
      useSystemFonts: true,
      standardFontDataUrl: join(
        process.cwd(),
        "node_modules/pdfjs-dist/standard_fonts/"
      ),
    }).promise;

    const pages: string[] = [];
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      const text = content.items
        .map((item) => ("str" in item ? item.str : ""))
        .join(" ");
      pages.push(text);
    }

    const result = pages.join("\n\n");

    if (!result.trim()) {
      return NextResponse.json(
        { error: "Aucun texte extractible dans ce PDF. Verifiez que le PDF contient du texte et non des images scannees." },
        { status: 422 }
      );
    }

    return NextResponse.json({ text: result });
  } catch {
    return NextResponse.json(
      { error: "Erreur lors de la lecture du PDF" },
      { status: 500 }
    );
  }
}
