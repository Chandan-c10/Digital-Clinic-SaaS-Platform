"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type Status = "verifying" | "success" | "error";

export function VerifyEmailStatus({ token }: { token: string }) {
  const [status, setStatus] = useState<Status>("verifying");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    fetch("/api/auth/verify-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    })
      .then(async (res) => {
        if (cancelled) return;
        if (!res.ok) {
          const body = await res.json().catch(() => ({ message: "Could not verify this link" }));
          setError(Array.isArray(body.message) ? body.message.join(", ") : body.message);
          setStatus("error");
          return;
        }
        setStatus("success");
      })
      .catch(() => {
        if (!cancelled) {
          setError("Could not reach the server");
          setStatus("error");
        }
      });

    return () => {
      cancelled = true;
    };
  }, [token]);

  if (status === "verifying") {
    return <p className="text-sm text-slate-500">Verifying your email…</p>;
  }

  if (status === "error") {
    return (
      <p role="alert" className="text-sm text-red-600">
        {error} — request a new link by trying to log in again.
      </p>
    );
  }

  return (
    <p role="status" className="text-sm text-emerald-700">
      Email verified. Log in as{" "}
      <Link href="/login" className="font-medium underline">
        staff
      </Link>{" "}
      or a{" "}
      <Link href="/portal/login" className="font-medium underline">
        patient
      </Link>
      .
    </p>
  );
}
