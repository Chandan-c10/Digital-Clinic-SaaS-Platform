"use client";

import { useFormState, useFormStatus } from "react-dom";
import { patientRegisterAction } from "../actions";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} className="w-full">
      {pending ? "Creating your account…" : "Create account"}
    </Button>
  );
}

export function RegisterForm() {
  const [state, formAction] = useFormState(patientRegisterAction, {
    error: undefined as string | undefined,
  });

  return (
    <form action={formAction} className="space-y-4">
      <Input label="Full name" name="name" required autoComplete="name" />
      <Input label="Email" name="email" type="email" required autoComplete="email" />
      <Input label="Phone (optional)" name="phone" type="tel" autoComplete="tel" />
      <Input
        label="Password"
        name="password"
        type="password"
        required
        minLength={8}
        autoComplete="new-password"
      />
      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
      <SubmitButton />
    </form>
  );
}
