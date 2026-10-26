"use client";

import React from "react";
import { useFormState, useFormStatus } from "react-dom";
import { LogIn, AlertCircle } from "lucide-react";
import { loginAction, LoginState } from "@/actions/auth";

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      style={{
        width: "100%",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: "0.5rem",
        background: pending ? "#6F665E" : "#3F5E5A",
        color: "#FFFDF9",
        padding: "0.75rem 1.25rem",
        borderRadius: "6px",
        fontSize: "0.9375rem",
        fontWeight: 500,
        border: "none",
        cursor: pending ? "not-allowed" : "pointer",
        transition: "background 0.15s ease",
      }}
    >
      <LogIn size={18} strokeWidth={1.75} />
      {pending ? "Authenticating..." : "Sign in to Radar"}
    </button>
  );
}

export function LoginForm({ returnUrl }: { returnUrl?: string }) {
  const [state, formAction] = useFormState<LoginState, FormData>(
    loginAction,
    null
  );

  return (
    <form action={formAction} style={{ display: "flex", flexDirection: "column", gap: "1.125rem" }}>
      {returnUrl && <input type="hidden" name="returnUrl" value={returnUrl} />}

      {state?.error && (
        <div
          role="alert"
          style={{
            display: "flex",
            alignItems: "flex-start",
            gap: "0.625rem",
            background: "#FBF2EE",
            border: "1px solid #E4C8BD",
            borderRadius: "6px",
            padding: "0.75rem 0.875rem",
            color: "#B5654A",
            fontSize: "0.875rem",
            lineHeight: 1.45,
          }}
        >
          <AlertCircle size={18} strokeWidth={1.75} style={{ flexShrink: 0, marginTop: "2px" }} />
          <span>{state.error}</span>
        </div>
      )}

      <div>
        <label
          htmlFor="email"
          style={{
            display: "block",
            fontSize: "0.8125rem",
            fontWeight: 600,
            color: "#2B2623",
            marginBottom: "0.375rem",
          }}
        >
          Institutional Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          placeholder="e.g. instructor@radar.edu, mentor@radar.edu, student@radar.edu"
          style={{
            width: "100%",
            boxSizing: "border-box",
            padding: "0.625rem 0.75rem",
            borderRadius: "6px",
            border: state?.fieldErrors?.email ? "1px solid #B5654A" : "1px solid #D8C7B5",
            background: "#FFFDF9",
            color: "#2B2623",
            fontSize: "0.9375rem",
            outline: "none",
          }}
        />
        {state?.fieldErrors?.email && (
          <span style={{ display: "block", fontSize: "0.75rem", color: "#B5654A", marginTop: "0.25rem" }}>
            {state.fieldErrors.email[0]}
          </span>
        )}
      </div>

      <div>
        <label
          htmlFor="password"
          style={{
            display: "block",
            fontSize: "0.8125rem",
            fontWeight: 600,
            color: "#2B2623",
            marginBottom: "0.375rem",
          }}
        >
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          autoComplete="current-password"
          placeholder="Enter institutional account password"
          style={{
            width: "100%",
            boxSizing: "border-box",
            padding: "0.625rem 0.75rem",
            borderRadius: "6px",
            border: state?.fieldErrors?.password ? "1px solid #B5654A" : "1px solid #D8C7B5",
            background: "#FFFDF9",
            color: "#2B2623",
            fontSize: "0.9375rem",
            outline: "none",
          }}
        />
        {state?.fieldErrors?.password && (
          <span style={{ display: "block", fontSize: "0.75rem", color: "#B5654A", marginTop: "0.25rem" }}>
            {state.fieldErrors.password[0]}
          </span>
        )}
      </div>

      <SubmitButton />
    </form>
  );
}
