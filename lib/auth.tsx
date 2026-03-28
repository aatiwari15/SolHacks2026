"use client";

import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useState,
} from "react";
import type { Session, User } from "@supabase/supabase-js";
import { EMPTY_PROFILE_RECORD, type ProfileRecord } from "@/lib/profile";
import { getSupabaseBrowserClient } from "@/lib/supabase";

type AppUser = {
  id: string;
  email: string;
  name: string;
  joinedAt: string;
  preferredLanguage?: string;
  profile: ProfileRecord;
};

type SignupPayload = {
  name: string;
  email: string;
  password: string;
  preferredLanguage: string;
};

type AuthContextValue = {
  user: AppUser | null;
  session: Session | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<AppUser>;
  signup: (payload: SignupPayload) => Promise<{ user: AppUser | null; emailConfirmationRequired: boolean }>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function mapSupabaseUser(user: User | null): AppUser | null {
  if (!user?.email) {
    return null;
  }

  const metadata = user.user_metadata ?? {};
  const name =
    typeof metadata.name === "string" && metadata.name.trim().length > 0
      ? metadata.name
      : user.email.split("@")[0] || "User";

  const preferredLanguage =
    typeof metadata.preferredLanguage === "string" && metadata.preferredLanguage.trim().length > 0
      ? metadata.preferredLanguage
      : undefined;

  return {
    id: user.id,
    email: user.email,
    name,
    joinedAt: user.created_at ?? new Date().toISOString(),
    preferredLanguage,
    profile: {
      ...EMPTY_PROFILE_RECORD,
      preferredLanguage: preferredLanguage ?? "",
      fullName: name,
      email: user.email,
    },
  };
}

async function syncProfile(session: Session, profile: Partial<ProfileRecord>) {
  const response = await fetch("/api/profile", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify(profile),
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(payload?.error || "We created your account, but couldn't save your profile.");
  }
}

async function ensureProfileForSession(session: Session | null) {
  const preferredLanguage =
    typeof session?.user?.user_metadata?.preferredLanguage === "string"
      ? session.user.user_metadata.preferredLanguage.trim()
      : "";
  const fullName =
    typeof session?.user?.user_metadata?.name === "string" ? session.user.user_metadata.name.trim() : "";
  const email = session?.user?.email?.trim() ?? "";

  if (!session) {
    return;
  }

  await syncProfile(session, {
    preferredLanguage,
    fullName,
    email,
  });
}

async function safeEnsureProfileForSession(session: Session | null) {
  if (!session) {
    return;
  }

  try {
    await ensureProfileForSession(session);
  } catch (error) {
    console.warn(
      "Profile sync failed; continuing with auth session.",
      error instanceof Error ? error.message : error,
    );
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const supabase = getSupabaseBrowserClient();

  useEffect(() => {
    let mounted = true;

    async function initialize() {
      const {
        data: { session: currentSession },
      } = await supabase.auth.getSession();

      if (!mounted) {
        return;
      }

      await safeEnsureProfileForSession(currentSession);
      setSession(currentSession);
      setUser(mapSupabaseUser(currentSession?.user ?? null));
      setLoading(false);
    }

    void initialize();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      void safeEnsureProfileForSession(nextSession);
      setSession(nextSession);
      setUser(mapSupabaseUser(nextSession?.user ?? null));
      setLoading(false);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [supabase]);

  async function login(email: string, password: string) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      throw new Error(error.message);
    }

    const appUser = mapSupabaseUser(data.user);

    if (!appUser) {
      throw new Error("Could not load your account.");
    }

    await safeEnsureProfileForSession(data.session);
    setSession(data.session);
    setUser(appUser);

    return appUser;
  }

  async function signup({ name, email, password, preferredLanguage }: SignupPayload) {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          name,
          preferredLanguage,
        },
      },
    });

    if (error) {
      throw new Error(error.message);
    }

    await safeEnsureProfileForSession(data.session);

    const appUser = mapSupabaseUser(data.user);

    setSession(data.session ?? null);
    setUser(data.session ? appUser : null);

    return {
      user: data.session ? appUser : null,
      emailConfirmationRequired: !data.session,
    };
  }

  async function logout() {
    const { error } = await supabase.auth.signOut();

    if (error) {
      throw new Error(error.message);
    }

    setSession(null);
    setUser(null);
  }

  const value: AuthContextValue = {
    user,
    session,
    loading,
    login,
    signup,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }

  return context;
}
