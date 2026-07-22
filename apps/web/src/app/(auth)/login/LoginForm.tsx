"use client";

import { useFormState, useFormStatus } from "react-dom";
import { loginAction } from "../actions";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} className="w-full">
      {pending ? "Logging in…" : "Log in"}
    </Button>
  );
}

export function LoginForm() {
  const [state, formAction] = useFormState(loginAction, { error: undefined as string | undefined });

  return (
    <form action={formAction} className="space-y-4">
      <Input label="Email" name="email" type="email" required autoComplete="email" />
      <Input label="Password" name="password" type="password" required autoComplete="current-password" />
      {state?.error && (
        <p role="alert" className="text-sm text-red-600">
          {state.error}
        </p>
      )}
      <SubmitButton />
    </form>
  );
}
