import type { NextApiRequest, NextApiResponse } from "next";
import { mapProfileRow, normalizeProfileInput, type ProfileRecord } from "@/lib/profile";
import { supabaseAdmin } from "@/server/lib/supabase";

type ErrorResponse = {
  error: string;
};

type ProfileResponse = {
  ok: true;
  profile: ProfileRecord;
};

function isMissingColumnError(message: string) {
  const normalized = message.toLowerCase();
  return normalized.includes("column") && (
    normalized.includes("does not exist") ||
    normalized.includes("schema cache")
  );
}

function isMissingProfilesTableError(message: string) {
  const normalized = message.toLowerCase();
  return normalized.includes("could not find the table") || normalized.includes("relation \"profiles\" does not exist");
}

async function getAuthorizedUser(req: NextApiRequest) {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;

  if (!token) {
    return { ok: false as const, error: "Missing authorization token" };
  }

  const { data: authData, error: authError } = await supabaseAdmin.auth.getUser(token);

  if (authError || !authData.user) {
    return { ok: false as const, error: "Invalid session" };
  }

  return { ok: true as const, token, user: authData.user };
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ProfileResponse | ErrorResponse>,
) {
  if (req.method !== "GET" && req.method !== "POST") {
    res.setHeader("Allow", "GET, POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const authResult = await getAuthorizedUser(req);

  if (!authResult.ok) {
    return res.status(401).json({ error: authResult.error });
  }

  if (req.method === "GET") {
    const { data, error } = await supabaseAdmin
      .from("profiles")
      .select("*")
      .eq("user_id", authResult.user.id)
      .maybeSingle();

    if (error && isMissingProfilesTableError(error.message)) {
      return res.status(200).json({
        ok: true,
        profile: {
          ...mapProfileRow(null),
          preferredLanguage:
            typeof authResult.user.user_metadata?.preferredLanguage === "string"
              ? authResult.user.user_metadata.preferredLanguage
              : "",
          fullName:
            typeof authResult.user.user_metadata?.name === "string"
              ? authResult.user.user_metadata.name
              : "",
          email: authResult.user.email ?? "",
        },
      });
    }

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    return res.status(200).json({
      ok: true,
      profile: mapProfileRow(data as Record<string, unknown> | null),
    });
  }

  const profileInput = normalizeProfileInput(req.body);

  const { error: profileError, data } = await supabaseAdmin
    .from("profiles")
    .upsert(
      {
        user_id: authResult.user.id,
        native_language: profileInput.preferredLanguage,
        full_name: profileInput.fullName,
        phone_number: profileInput.phoneNumber,
        email: profileInput.email || authResult.user.email || "",
        contact_name: profileInput.contactName,
        contact_phone: profileInput.contactPhone,
        address_line_1: profileInput.addressLine1,
        address_line_2: profileInput.addressLine2,
        city: profileInput.city,
        state_region: profileInput.stateRegion,
        postal_code: profileInput.postalCode,
        country: profileInput.country,
        expertise_level: "learner",
        community_tags: [],
      },
      { onConflict: "user_id" },
    )
    .select("*")
    .single();

  if (profileError && isMissingProfilesTableError(profileError.message)) {
    console.warn("Profiles table is missing in Supabase; continuing without persisted profile data.");
    return res.status(200).json({
      ok: true,
      profile: {
        ...profileInput,
        email: profileInput.email || authResult.user.email || "",
      },
    });
  }

  if (profileError && isMissingColumnError(profileError.message)) {
    const { error: fallbackError, data: fallbackData } = await supabaseAdmin
      .from("profiles")
      .upsert(
        {
          user_id: authResult.user.id,
          native_language: profileInput.preferredLanguage,
          expertise_level: "learner",
          community_tags: [],
        },
        { onConflict: "user_id" },
      )
      .select("*")
      .single();

    if (fallbackError) {
      console.error("Profile fallback upsert failed:", fallbackError.message);
      return res.status(500).json({ error: fallbackError.message });
    }

    return res.status(200).json({
      ok: true,
      profile: mapProfileRow(fallbackData as Record<string, unknown>),
    });
  }

  if (profileError) {
    console.error("Profile upsert failed:", profileError.message);
    return res.status(500).json({ error: profileError.message });
  }

  return res.status(200).json({
    ok: true,
    profile: mapProfileRow(data as Record<string, unknown>),
  });
}
