/**
 * Turn raw extension form fields + answers into display rows (English prompts).
 */

export type RawFormField = {
  field_key?: string;
  label?: string;
};

export type ApplicationFieldRow = {
  fieldKey: string;
  questionEn: string;
  questionTranslated: string;
  value: string;
};

/**
 * Normalize arbitrary text before passing it to the Linda agent.
 * - Splits camelCase into separate words (e.g. "firstName" → "first Name")
 * - Strips characters that aren't alphanumeric, whitespace, or common punctuation (.,!?'-/)
 * - Collapses runs of whitespace to a single space
 */
export function sanitizeForAgent(text: string): string {
  // Split camelCase boundaries
  const spaced = text.replace(/([a-z])([A-Z])/g, "$1 $2");
  // Strip unusual non-alphanumeric characters (keep letters, digits, spaces, .,!?'-/)
  const stripped = spaced.replace(/[^\w\s.,!?'\-/]/g, " ");
  // Collapse whitespace
  return stripped.replace(/\s+/g, " ").trim();
}

/** e.g. emailAddress → "Email address", $$preferredName → "Preferred name" */
export function humanizeFieldKey(key: string): string {
  const k = key.replace(/^\$+/, "").replace(/_/g, " ").trim();
  if (!k) return "Field";
  const spaced = k.replace(/([a-z])([A-Z])/g, "$1 $2");
  const lower = spaced.toLowerCase();
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}

function pickLabel(f: RawFormField, fallbackKey: string): string {
  const raw = typeof f.label === "string" ? f.label.trim() : "";
  if (raw.length > 0) return raw;
  return humanizeFieldKey(fallbackKey);
}

export function buildRowsFromFormFields(
  formFields: unknown[],
  answers: Record<string, string>,
): Omit<ApplicationFieldRow, "questionTranslated">[] {
  return formFields.map((item, i) => {
    const f = (item && typeof item === "object" ? item : {}) as RawFormField;
    const fieldKey = String(f.field_key ?? `field_${i}`).trim() || `field_${i}`;
    const questionEn = pickLabel(f, fieldKey);
    const value = String(answers[fieldKey] ?? "");
    return { fieldKey, questionEn, value };
  });
}

/** Map profile / UI language strings to a BCP-47-ish code for APIs */
export function resolveApplicantLanguageCode(raw: string): { code: string; label: string } {
  const t = raw.trim().toLowerCase();
  if (!t || t === "en" || t === "english") {
    return { code: "en", label: "English" };
  }
  if (
    t === "es" ||
    t.startsWith("es-") ||
    t.includes("spanish") ||
    t.includes("español") ||
    t.includes("espanol")
  ) {
    return { code: "es", label: "Spanish" };
  }
  return { code: t.slice(0, 12) || "en", label: raw.trim() || "English" };
}
