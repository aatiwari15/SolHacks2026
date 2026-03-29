"use client";

import { UnidadChat } from "@/components/unidad/unidad-chat";

export function CurrentAppPage({
  applicantLanguage,
  onOpenFaq,
  onOpenProfileSettings,
}: {
  /** Supabase `profiles.native_language` (loaded as `preferredLanguage` on the client) */
  applicantLanguage: string;
  onOpenFaq: () => void;
  onOpenProfileSettings: () => void;
}) {
  return (
    <UnidadChat
      applicantLanguage={applicantLanguage}
      onOpenFaq={onOpenFaq}
      onOpenProfileSettings={onOpenProfileSettings}
    />
  );
}
