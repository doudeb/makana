import { singleAnswerSchema } from "@/lib/schemas/student";
import { processSubmission, SubmitError } from "@/lib/submit-service";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json(
      { error: "Corps de requete JSON invalide" },
      { status: 400 }
    );
  }

  const parsed = singleAnswerSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const encoder = new TextEncoder();

  function send(event: string, data: unknown): Uint8Array {
    return encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  }

  const stream = new ReadableStream({
    async start(controller) {
      try {
        controller.enqueue(
          send("status", { stage: "received", message: "Reponse recue..." })
        );

        controller.enqueue(
          send("status", {
            stage: "analyzing",
            message: "L'IA analyse ta reponse...",
          })
        );

        const result = await processSubmission(parsed.data);

        controller.enqueue(send("result", result));
        controller.close();
      } catch (err) {
        if (err instanceof SubmitError) {
          controller.enqueue(send("error", { message: err.message }));
        } else {
          console.error("Stream error:", err);
          controller.enqueue(
            send("error", { message: "Une erreur inattendue est survenue" })
          );
        }
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
