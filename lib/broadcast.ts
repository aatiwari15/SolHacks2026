import { supabase } from "./supabase";
import type { RealtimeChannel } from "@supabase/supabase-js";

// ── Types ─────────────────────────────────────────────────────────────────────

export type HighlightColor = "yellow" | "blue" | "green" | "red";

export interface FieldHighlightPayload {
  fieldId: string;
  color: HighlightColor;
  label?: string;
}

export interface CursorMovePayload {
  x: number;
  y: number;
  agentId: "dante";
}

export interface FormStatusPayload {
  fieldId: string;
  status: "filling" | "filled" | "error";
  value?: string; // only non-PII display values
}

export type BroadcastEvent =
  | { event: "field_highlight"; payload: FieldHighlightPayload }
  | { event: "cursor_move"; payload: CursorMovePayload }
  | { event: "form_status"; payload: FormStatusPayload };

// ── Channel factory ───────────────────────────────────────────────────────────

/**
 * Creates a Supabase Broadcast channel scoped to a LiveKit room.
 * Both the Selenium backend and the Next.js frontend join the same channel.
 */
export function createBroadcastChannel(roomId: string): RealtimeChannel {
  return supabase.channel(`room:${roomId}`);
}

/**
 * Subscribe to all broadcast events for a room.
 * Returns an unsubscribe function.
 */
export function subscribeToBroadcast(
  roomId: string,
  onEvent: (event: BroadcastEvent) => void,
): () => void {
  const channel = createBroadcastChannel(roomId)
    .on("broadcast", { event: "field_highlight" }, ({ payload }) =>
      onEvent({ event: "field_highlight", payload }),
    )
    .on("broadcast", { event: "cursor_move" }, ({ payload }) =>
      onEvent({ event: "cursor_move", payload }),
    )
    .on("broadcast", { event: "form_status" }, ({ payload }) =>
      onEvent({ event: "form_status", payload }),
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

/**
 * Send a broadcast event from the Selenium automation side.
 * Call this from a Next.js API route that the Selenium script POSTs to.
 */
export async function sendBroadcast(
  roomId: string,
  event: BroadcastEvent,
): Promise<void> {
  const channel = createBroadcastChannel(roomId);
  await channel.subscribe();
  await channel.send({
    type: "broadcast",
    event: event.event,
    payload: event.payload,
  });
  await supabase.removeChannel(channel);
}
