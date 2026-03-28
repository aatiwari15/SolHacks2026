import { getSupabaseBrowserClient } from "./supabase";
import type { RealtimeChannel } from "@supabase/supabase-js";

// ── Types ─────────────────────────────────────────────────────────────────────

export type GuideStatus = "ready" | "in_call" | "away";

export interface GuidePresence {
  userId: string;
  displayName: string;
  expertiseTags: string[]; // e.g. ["Texas DMV", "USCIS I-485"]
  nativeLanguage: string;
  status: GuideStatus;
  onlineSince: string; // ISO timestamp
}

export type PresenceMap = Record<string, GuidePresence[]>;

// ── Channel factory ───────────────────────────────────────────────────────────

const COMMUNITY_CHANNEL = "community:guides";

/**
 * Join the global community presence channel and track this user's state.
 * Returns an untrack/unsubscribe function.
 */
export function joinCommunityPresence(
  guide: GuidePresence,
  onChange: (guides: GuidePresence[]) => void,
): () => void {
  const supabase = getSupabaseBrowserClient();
  const channel: RealtimeChannel = supabase
    .channel(COMMUNITY_CHANNEL)
    .on("presence", { event: "sync" }, () => {
      const state = channel.presenceState<GuidePresence>();
      onChange(flattenPresence(state));
    })
    .on("presence", { event: "join" }, () => {
      const state = channel.presenceState<GuidePresence>();
      onChange(flattenPresence(state));
    })
    .on("presence", { event: "leave" }, () => {
      const state = channel.presenceState<GuidePresence>();
      onChange(flattenPresence(state));
    })
    .subscribe(async (status) => {
      if (status === "SUBSCRIBED") {
        await channel.track(guide);
      }
    });

  return () => {
    void channel.untrack();
    void supabase.removeChannel(channel);
  };
}

/**
 * Flatten the Supabase presence map into a sorted list of online guides.
 * Sorted: "ready" first, then "in_call", then "away".
 */
function flattenPresence(state: PresenceMap): GuidePresence[] {
  const statusOrder: Record<GuideStatus, number> = {
    ready: 0,
    in_call: 1,
    away: 2,
  };

  return Object.values(state)
    .flat()
    .sort(
      (a, b) => statusOrder[a.status] - statusOrder[b.status],
    );
}
