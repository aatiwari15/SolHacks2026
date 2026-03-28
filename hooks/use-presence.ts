"use client";

import { useEffect, useState } from "react";
import {
  joinCommunityPresence,
  type GuidePresence,
} from "@/lib/presence";

/**
 * Joins the community presence channel and returns the live list of online guides.
 * Pass `null` as guide to subscribe as a read-only observer (learner view).
 *
 * @example
 * const guides = usePresence(currentGuide);
 * // guides = [{ displayName: "Maria", status: "ready", expertiseTags: ["Texas DMV"] }, ...]
 */
export function usePresence(guide: GuidePresence | null): GuidePresence[] {
  const [guides, setGuides] = useState<GuidePresence[]>([]);

  useEffect(() => {
    if (!guide) return;

    const leave = joinCommunityPresence(guide, setGuides);
    return leave;
  }, [guide?.userId]);

  return guides;
}
