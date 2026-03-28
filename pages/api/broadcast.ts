/**
 * POST /api/broadcast
 *
 * Relay endpoint for the Selenium bot (Dante).
 * Dante sends a POST here; this server-side handler forwards it to
 * Supabase Broadcast so the frontend receives it instantly.
 *
 * Body: { roomId: string; event: BroadcastEvent }
 * Auth: Bearer token checked against BROADCAST_SECRET.
 */

import type { NextApiRequest, NextApiResponse } from "next";
import { sendBroadcast, type BroadcastEvent } from "@/lib/broadcast";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const authHeader = req.headers.authorization ?? "";
  if (authHeader !== `Bearer ${process.env.BROADCAST_SECRET}`) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const { roomId, event } = req.body as {
    roomId: string;
    event: BroadcastEvent;
  };

  if (!roomId || !event) {
    return res.status(400).json({ error: "roomId and event are required" });
  }

  await sendBroadcast(roomId, event);
  return res.status(200).json({ ok: true });
}
