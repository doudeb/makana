"use client";

import { useRef, useCallback, useState } from "react";
import { parseSSEChunk } from "@/lib/sse-parser";

interface SubmitStreamCallbacks {
  onStatus: (stage: string, message: string) => void;
  onResult: (data: {
    submission_id: string;
    question_id: string;
    score: number | null;
    feedback: string;
  }) => void;
  onError: (message: string) => void;
}

export function useSubmitStream(callbacks: SubmitStreamCallbacks) {
  const [isLoading, setIsLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const callbacksRef = useRef(callbacks);
  callbacksRef.current = callbacks;

  const submit = useCallback(async (body: Record<string, unknown>) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    const timeout = setTimeout(() => controller.abort(), 30_000);
    setIsLoading(true);

    try {
      const res = await fetch("/api/submit-stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => null);
        throw new Error(err?.error ?? "Erreur lors de la soumission");
      }

      const reader = res.body?.getReader();
      if (!reader) throw new Error("Stream non disponible");

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const { events, remaining } = parseSSEChunk(
          buffer,
          decoder.decode(value, { stream: true })
        );
        buffer = remaining;

        for (const evt of events) {
          const parsed = JSON.parse(evt.data);
          if (evt.event === "status") {
            callbacksRef.current.onStatus(parsed.stage, parsed.message);
          } else if (evt.event === "result") {
            callbacksRef.current.onResult(parsed);
          } else if (evt.event === "error") {
            callbacksRef.current.onError(parsed.message);
          }
        }
      }
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        callbacksRef.current.onError(
          (err as Error).message || "Une erreur est survenue"
        );
      }
    } finally {
      clearTimeout(timeout);
      setIsLoading(false);
      abortRef.current = null;
    }
  }, []);

  return { submit, isLoading };
}
