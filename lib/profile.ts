export type ProfileRecord = {
  preferredLanguage: string;
  fullName: string;
  phoneNumber: string;
  email: string;
  contactName: string;
  contactPhone: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  stateRegion: string;
  postalCode: string;
  country: string;
};

export const EMPTY_PROFILE_RECORD: ProfileRecord = {
  preferredLanguage: "",
  fullName: "",
  phoneNumber: "",
  email: "",
  contactName: "",
  contactPhone: "",
  addressLine1: "",
  addressLine2: "",
  city: "",
  stateRegion: "",
  postalCode: "",
  country: "",
};

function cleanString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export function normalizeProfileInput(input: unknown): ProfileRecord {
  const payload = typeof input === "object" && input !== null ? (input as Record<string, unknown>) : {};

  return {
    preferredLanguage: cleanString(payload.preferredLanguage),
    fullName: cleanString(payload.fullName),
    phoneNumber: cleanString(payload.phoneNumber),
    email: cleanString(payload.email),
    contactName: cleanString(payload.contactName),
    contactPhone: cleanString(payload.contactPhone),
    addressLine1: cleanString(payload.addressLine1),
    addressLine2: cleanString(payload.addressLine2),
    city: cleanString(payload.city),
    stateRegion: cleanString(payload.stateRegion),
    postalCode: cleanString(payload.postalCode),
    country: cleanString(payload.country),
  };
}

export function mapProfileRow(row: Record<string, unknown> | null | undefined): ProfileRecord {
  if (!row) {
    return EMPTY_PROFILE_RECORD;
  }

  return {
    preferredLanguage: cleanString(row.native_language),
    fullName: cleanString(row.full_name),
    phoneNumber: cleanString(row.phone_number),
    email: cleanString(row.email),
    contactName: cleanString(row.contact_name),
    contactPhone: cleanString(row.contact_phone),
    addressLine1: cleanString(row.address_line_1),
    addressLine2: cleanString(row.address_line_2),
    city: cleanString(row.city),
    stateRegion: cleanString(row.state_region),
    postalCode: cleanString(row.postal_code),
    country: cleanString(row.country),
  };
}

export function isProfileReadyForAutofill(profile: ProfileRecord) {
  return [
    profile.fullName,
    profile.email,
    profile.phoneNumber,
    profile.addressLine1,
    profile.city,
    profile.stateRegion,
    profile.postalCode,
    profile.country,
  ].every((value) => value.trim().length > 0);
}
