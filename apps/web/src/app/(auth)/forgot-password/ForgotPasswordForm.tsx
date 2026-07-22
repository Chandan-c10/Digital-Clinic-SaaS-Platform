"use client";

import { useFormState, useFormStatus } from "react-dom";
import { forgotPasswordAction } from "../actions";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} className="w-full">
      {pending ? "Sending…" : "Send reset link"}
    </Button>
  );
}

export function ForgotPasswordForm() {
  const [state, formAction] = useFormState(forgotPasswordAction, {
    message: undefined as string | undefined,
  });

  if (state?.message) {
    return (
      <p role="status" className="text-sm text-slate-700">
        {state.message}
      </p>
    );
  }

  return (
    <form action={formAction} className="space-y-4">
      <Input label="Email" name="email" type="email" required autoComplete="email" />
      <SubmitButton />
    </form>
  );
}
