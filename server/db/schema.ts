import {
  pgTable,
  pgEnum,
  uuid,
  text,
  jsonb,
  timestamp,
} from "drizzle-orm/pg-core";

// Run the SQL in supabase/migrations/add_form_submissions.sql to create this table.

// ─── Enums ────────────────────────────────────────────────────────────────────

export const expertiseLevelEnum = pgEnum("expertise_level", [
  "learner",
  "guide",
]);

export const agentEnum = pgEnum("agent", ["dante", "mismo", "simpli"]);

export const sessionStatusEnum = pgEnum("session_status", [
  "pending",
  "active",
  "completed",
  "error",
]);

// ─── profiles ─────────────────────────────────────────────────────────────────
// One row per authenticated user. Linked to auth.users via user_id.

export const profiles = pgTable("profiles", {
  id: uuid("id").primaryKey().defaultRandom(),
  // References auth.users — enforced at the Supabase RLS layer.
  userId: uuid("user_id").notNull().unique(),
  nativeLanguage: text("native_language").notNull(),
  fullName: text("full_name").notNull().default(""),
  phoneNumber: text("phone_number").notNull().default(""),
  email: text("email").notNull().default(""),
  contactName: text("contact_name").notNull().default(""),
  contactPhone: text("contact_phone").notNull().default(""),
  addressLine1: text("address_line_1").notNull().default(""),
  addressLine2: text("address_line_2").notNull().default(""),
  city: text("city").notNull().default(""),
  stateRegion: text("state_region").notNull().default(""),
  postalCode: text("postal_code").notNull().default(""),
  country: text("country").notNull().default(""),
  expertiseLevel: expertiseLevelEnum("expertise_level")
    .notNull()
    .default("learner"),
  // Array of community tags, e.g. ["Texas DMV", "USCIS I-485"]
  communityTags: text("community_tags").array().notNull().default([]),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ─── sessions ─────────────────────────────────────────────────────────────────
// Tracks a single "Node" — one LiveKit room ↔ one Selenium session.

export const sessions = pgTable("sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  profileId: uuid("profile_id")
    .notNull()
    .references(() => profiles.id, { onDelete: "cascade" }),
  livekitRoomId: text("livekit_room_id").notNull(),
  seleniumSessionId: text("selenium_session_id"),
  status: sessionStatusEnum("status").notNull().default("pending"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  endedAt: timestamp("ended_at"),
});

// ─── agent_logs ───────────────────────────────────────────────────────────────
// Stores each agent's chain-of-thought so Simpli can look back at what
// Mismo said when generating a cheat sheet.

export const agentLogs = pgTable("agent_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  sessionId: uuid("session_id")
    .notNull()
    .references(() => sessions.id, { onDelete: "cascade" }),
  agent: agentEnum("agent").notNull(),
  // Full IBM Orchestrate / Gemini chain-of-thought blob.
  chainOfThought: jsonb("chain_of_thought").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ─── form_vault ───────────────────────────────────────────────────────────────
// PII is stored via Supabase Vault (pgsodium TDE).
// This table stores the vault secret_id + metadata — never the raw value.
//
// How to write:
//   SELECT vault.create_secret('{"ssn":"123-45-6789"}', 'form_data_<session_id>');
//   -- then store the returned UUID here as vaultSecretId.
//
// How to read (server-side only, RLS enforced):
//   SELECT decrypted_secret FROM vault.decrypted_secrets WHERE id = <vaultSecretId>;

// ─── form_submissions ─────────────────────────────────────────────────────────
// Receives form data posted by the browser extension.
// Agents poll GET /api/form-submission (with BROADCAST_SECRET) to process these.

export const formSubmissionStatusEnum = pgEnum("form_submission_status", [
  "pending",
  "processing",
  "done",
]);

export const formSubmissions = pgTable("form_submissions", {
  id: uuid("id").primaryKey().defaultRandom(),
  // Identifies the extension instance — generated once, stored in chrome.storage.local.
  sessionToken: text("session_token").notNull(),
  pageUrl: text("page_url").notNull(),
  pageTitle: text("page_title").notNull().default(""),
  // Full formConfig.fields array serialised as JSON.
  formFields: jsonb("form_fields").notNull(),
  // { field_key: value } answers the user filled in.
  answers: jsonb("answers").notNull(),
  status: formSubmissionStatusEnum("status").notNull().default("pending"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ─── form_vault ───────────────────────────────────────────────────────────────
export const formVault = pgTable("form_vault", {
  id: uuid("id").primaryKey().defaultRandom(),
  sessionId: uuid("session_id")
    .notNull()
    .references(() => sessions.id, { onDelete: "cascade" }),
  // UUID returned by vault.create_secret() — points to encrypted PII.
  vaultSecretId: uuid("vault_secret_id").notNull(),
  // Human-readable label so Dante knows which form this belongs to.
  formLabel: text("form_label").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
