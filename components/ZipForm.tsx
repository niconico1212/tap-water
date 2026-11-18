"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

export function ZipForm({ size = "lg", initial = "" }: { size?: "lg" | "sm"; initial?: string }) {
  const router = useRouter();
  const [zip, setZip] = useState(initial);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const lg = size === "lg";

  return (
    <form
      className="w-full"
      onSubmit={(e) => {
        e.preventDefault();
        if (!/^\d{5}$/.test(zip)) {
          setError("Enter a 5-digit ZIP code.");
          return;
        }
        start(() => router.push(`/zip/${zip}`));
      }}
    >
      <div className="flex gap-2">
        <label htmlFor={`zip-${size}`} className="sr-only">
          ZIP code
        </label>
        <input
          id={`zip-${size}`}
          name="zip"
          inputMode="numeric"
          autoComplete="postal-code"
          pattern="\d{5}"
          maxLength={5}
          placeholder="ZIP code"
          value={zip}
          onChange={(e) => {
            setZip(e.target.value.replace(/\D/g, "").slice(0, 5));
            setError("");
          }}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `zip-error-${size}` : undefined}
          className={`min-w-0 flex-1 rounded-xl border border-line bg-surface font-semibold tracking-widest text-ink placeholder:font-normal placeholder:tracking-normal placeholder:text-muted ${
            lg ? "px-5 py-4 text-2xl" : "px-3 py-2 text-base"
          }`}
        />
        <button
          type="submit"
          disabled={pending}
          className={`rounded-xl bg-accent font-semibold text-accent-ink disabled:opacity-60 ${
            lg ? "px-6 py-4 text-lg" : "px-4 py-2 text-sm"
          }`}
        >
          {pending ? "Checking…" : "Check"}
        </button>
      </div>
      {error && (
        <p id={`zip-error-${size}`} role="alert" className="mt-2 text-sm text-[var(--bad)]">
          {error}
        </p>
      )}
    </form>
  );
}
