"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { ProfileOnboardingModal } from "@/components/unidad/profile-onboarding-modal";
import { CurrentAppPage } from "@/components/unidad/current-app-page";
import { EMPTY_PROFILE_RECORD, isProfileReadyForAutofill, type ProfileRecord } from "@/lib/profile";
import { useAuth } from "@/lib/auth";

export default function AppPage() {
  const { loading, session, user } = useAuth();
  const router = useRouter();
  const [profile, setProfile] = useState<ProfileRecord>(EMPTY_PROFILE_RECORD);
  const [profileLoading, setProfileLoading] = useState(true);
  const [showOnboarding, setShowOnboarding] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      void router.replace("/");
    }
  }, [loading, router, user]);

  useEffect(() => {
    if (!session || !user) {
      setProfile(EMPTY_PROFILE_RECORD);
      setProfileLoading(false);
      setShowOnboarding(false);
      return;
    }

    let active = true;
    const accessToken = session.access_token;
    const appUser = user;

    async function loadProfile() {
      setProfileLoading(true);

      try {
        const response = await fetch("/api/profile", {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        });

        if (!response.ok) {
          throw new Error("Could not load your saved profile.");
        }

        const payload = (await response.json()) as { ok: true; profile: ProfileRecord };

        if (!active) {
          return;
        }

        setProfile(payload.profile);
        setShowOnboarding(!isProfileReadyForAutofill(payload.profile));
      } catch {
        if (!active) {
          return;
        }

        const fallbackProfile: ProfileRecord = {
          ...EMPTY_PROFILE_RECORD,
          fullName: appUser.name,
          email: appUser.email,
          preferredLanguage: appUser.preferredLanguage ?? "",
        };

        setProfile(fallbackProfile);
        setShowOnboarding(!isProfileReadyForAutofill(fallbackProfile));
      } finally {
        if (active) {
          setProfileLoading(false);
        }
      }
    }

    void loadProfile();

    return () => {
      active = false;
    };
  }, [session, user]);

  async function handleSaveProfile(nextProfile: ProfileRecord) {
    if (!session) {
      throw new Error("Your session expired. Please sign in again.");
    }

    const response = await fetch("/api/profile", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify(nextProfile),
    });

    const payload = (await response.json().catch(() => null)) as
      | { ok?: true; profile?: ProfileRecord; error?: string }
      | null;

    if (!response.ok || !payload?.profile) {
      throw new Error(payload?.error || "We couldn't save your information.");
    }

    setProfile(payload.profile);
    setShowOnboarding(false);
  }

  if (loading || !user || profileLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0d0905]">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#d29c62] border-t-transparent" />
      </div>
    );
  }

  return (
    <>
      <CurrentAppPage />
      {showOnboarding ? (
        <ProfileOnboardingModal
          initialProfile={profile}
          onClose={() => setShowOnboarding(false)}
          onSave={handleSaveProfile}
        />
      ) : null}
    </>
  );
}
