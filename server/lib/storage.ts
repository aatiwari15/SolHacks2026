import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

const BUCKET = "audit-trail";

// ── Upload ────────────────────────────────────────────────────────────────────

/**
 * Upload a completed form PDF or Simpli cheat sheet to Supabase Storage.
 * Files are stored under: <sessionId>/<filename>
 */
export async function uploadAuditFile(
  sessionId: string,
  filename: string,
  content: Blob | Buffer,
  contentType: string,
): Promise<string> {
  const path = `${sessionId}/${filename}`;

  const { error } = await supabaseAdmin.storage
    .from(BUCKET)
    .upload(path, content, { contentType, upsert: true });

  if (error) throw new Error(`Storage upload failed: ${error.message}`);

  return path;
}

// ── Signed URL (expires in 24 h) ──────────────────────────────────────────────

const TWENTY_FOUR_HOURS = 60 * 60 * 24;

/**
 * Generate a temporary signed URL for a stored file.
 * The link expires after 24 hours, keeping sensitive docs off the public internet.
 */
export async function getSignedUrl(storagePath: string): Promise<string> {
  const { data, error } = await supabaseAdmin.storage
    .from(BUCKET)
    .createSignedUrl(storagePath, TWENTY_FOUR_HOURS);

  if (error || !data?.signedUrl) {
    throw new Error(`Failed to create signed URL: ${error?.message}`);
  }

  return data.signedUrl;
}

// ── Convenience: upload + return signed URL in one call ───────────────────────

export async function uploadAndSign(
  sessionId: string,
  filename: string,
  content: Blob | Buffer,
  contentType: string,
): Promise<string> {
  const path = await uploadAuditFile(sessionId, filename, content, contentType);
  return getSignedUrl(path);
}
