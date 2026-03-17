export interface SSEEvent {
  event: string;
  data: string;
}

export function parseSSEChunk(
  buffer: string,
  chunk: string
): { events: SSEEvent[]; remaining: string } {
  const text = buffer + chunk;
  const parts = text.split("\n\n");
  const remaining = parts.pop() ?? "";
  const events: SSEEvent[] = [];

  for (const part of parts) {
    if (!part.trim()) continue;
    let event = "message";
    let data = "";
    for (const line of part.split("\n")) {
      if (line.startsWith("event:")) event = line.slice(6).trim();
      else if (line.startsWith("data:")) data = line.slice(5).trim();
    }
    if (data) events.push({ event, data });
  }

  return { events, remaining };
}
