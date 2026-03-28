"use client";

import { useEffect, useRef } from "react";
import {
  subscribeToBroadcast,
  type BroadcastEvent,
} from "@/lib/broadcast";

/**
 * Subscribes to Dante's real-time browser-sync events for a given room.
 * Automatically cleans up on unmount or when roomId changes.
 *
 * @example
 * useBroadcast(roomId, (event) => {
 *   if (event.event === "field_highlight") {
 *     highlightField(event.payload.fieldId, event.payload.color);
 *   }
 * });
 */
export function useBroadcast(
  roomId: string | null,
  onEvent: (event: BroadcastEvent) => void,
): void {
  // Keep a stable ref so we don't re-subscribe when the callback identity changes.
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;

  useEffect(() => {
    if (!roomId) return;

    const unsubscribe = subscribeToBroadcast(roomId, (event) => {
      onEventRef.current(event);
    });

    return unsubscribe;
  }, [roomId]);
}
