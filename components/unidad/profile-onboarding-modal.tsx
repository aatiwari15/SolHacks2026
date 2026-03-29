"use client";

import { useEffect, useState } from "react";
import type { InputHTMLAttributes, ReactNode } from "react";
import { Loader2, MapPin, Phone, Save, ShieldCheck, X } from "lucide-react";
import { EMPTY_PROFILE_RECORD, type ProfileRecord } from "@/lib/profile";

type ProfileOnboardingModalProps = {
  initialProfile: ProfileRecord;
  onClose: () => void;
  onSave: (profile: ProfileRecord) => Promise<void>;
};

export function ProfileOnboardingModal({
  initialProfile,
  onClose,
  onSave,
}: ProfileOnboardingModalProps) {
  const [profile, setProfile] = useState<ProfileRecord>({
    ...EMPTY_PROFILE_RECORD,
    ...initialProfile,
  });
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  function updateField(field: keyof ProfileRecord, value: string) {
    setProfile((currentProfile) => ({
      ...currentProfile,
      [field]: value,
    }));
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSubmitting(true);

    try {
      await onSave(profile);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "We couldn't save your information.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[110] flex items-center justify-center bg-white/80 px-4 py-6 backdrop-blur-md"
      onClick={onClose}
    >
      <div
        className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-[28px] border border-nexus-border bg-nexus-surface shadow-[0_28px_90px_rgba(15,23,42,0.16)]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="border-b border-nexus-border bg-[radial-gradient(circle_at_top,rgba(21,128,61,0.12),transparent_48%)] px-6 py-5 sm:px-8">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-nexus-border bg-white/80 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-nexus-accent">
                <ShieldCheck className="h-3.5 w-3.5" />
                Autofill setup
              </div>
              <h2 className="text-2xl font-bold tracking-tight text-nexus-text">Save your common form details</h2>
              <p className="mt-2 max-w-xl text-sm leading-relaxed text-nexus-muted">
                Add the basics once so Unidad can reuse them for applications, housing forms, job documents, and
                other repetitive paperwork.
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl p-2 text-nexus-muted transition-colors hover:bg-nexus-card hover:text-nexus-text"
              aria-label="Close setup"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6 px-6 py-6 sm:px-8">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Full name"
              value={profile.fullName}
              autoComplete="name"
              onChange={(value) => updateField("fullName", value)}
            />
            <Field
              label="Phone number"
              value={profile.phoneNumber}
              autoComplete="tel"
              icon={<Phone className="h-4 w-4" />}
              onChange={(value) => updateField("phoneNumber", value)}
            />
            <Field
              label="Email"
              type="email"
              value={profile.email}
              autoComplete="email"
              onChange={(value) => updateField("email", value)}
            />
            <Field
              label="Preferred language"
              value={profile.preferredLanguage}
              autoComplete="language"
              onChange={(value) => updateField("preferredLanguage", value)}
            />
          </div>

          <div className="rounded-2xl border border-nexus-border bg-nexus-card/60 p-4">
            <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-nexus-text">
              <MapPin className="h-4 w-4 text-nexus-accent" />
              Address for common forms
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label="Street address"
                value={profile.addressLine1}
                autoComplete="address-line1"
                placeholder="123 Main St"
                className="sm:col-span-2"
                onChange={(value) => updateField("addressLine1", value)}
              />
              <Field
                label="Address line 2"
                value={profile.addressLine2}
                autoComplete="address-line2"
                onChange={(value) => updateField("addressLine2", value)}
              />
              <Field
                label="Apartment"
                value={profile.apartmentNumber}
                autoComplete="off"
                placeholder="Apartment or unit number (optional)"
                onChange={(value) => updateField("apartmentNumber", value)}
              />
              <Field
                label="City"
                value={profile.city}
                autoComplete="address-level2"
                onChange={(value) => updateField("city", value)}
              />
              <Field
                label="State / region"
                value={profile.stateRegion}
                autoComplete="address-level1"
                onChange={(value) => updateField("stateRegion", value)}
              />
              <Field
                label="Postal code"
                value={profile.postalCode}
                autoComplete="postal-code"
                onChange={(value) => updateField("postalCode", value)}
              />
              <Field
                label="Country"
                value={profile.country}
                autoComplete="country-name"
                onChange={(value) => updateField("country", value)}
              />
            </div>
          </div>

          {error ? <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div> : null}

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-nexus-muted">
              You can edit this later. We’ll use it as a starting point whenever a form needs common details.
            </p>
            <button
              type="submit"
              disabled={submitting}
              className="btn-primary flex h-12 min-w-[220px] items-center justify-center gap-2 px-6 text-sm sm:text-base"
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Saving details...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4" />
                  Save and continue
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  autoComplete,
  icon,
  placeholder,
  className,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: InputHTMLAttributes<HTMLInputElement>["type"];
  autoComplete?: string;
  icon?: ReactNode;
  placeholder?: string;
  className?: string;
}) {
  return (
    <label className={`space-y-1.5 ${className ?? ""}`}>
      <span className="text-sm font-medium text-nexus-muted">{label}</span>
      <div className="relative">
        <input
          type={type}
          value={value}
          autoComplete={autoComplete}
          placeholder={placeholder}
          onChange={(event) => onChange(event.target.value)}
          className={`input-field ${icon ? "pr-11" : ""}`}
        />
        {icon ? <span className="pointer-events-none absolute top-1/2 right-4 -translate-y-1/2 text-nexus-muted">{icon}</span> : null}
      </div>
    </label>
  );
}
