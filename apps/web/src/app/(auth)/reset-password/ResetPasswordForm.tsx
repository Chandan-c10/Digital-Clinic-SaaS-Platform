"use client";

import { useFormState, useFormStatus } from "react-dom";
import { resetPasswordAction } from "../actions";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} className="w-full">
      {pending ? "Saving…" : "Set new password"}
    </Button>
  );
}

export function ResetPasswordForm({ token }: { token: string }) {
  const [state, formAction] = useFormState(resetPasswordAction, {
    error: undefined as string | undefined,
  });

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="token" value={token} />
      <Input
        label="New password"
        name="newPassword"
        type="password"
        required
        minLength={8}
        autoComplete="new-password"
      />
      {state?.error && (
        <p role="alert" className="text-sm text-red-600">
          {state.error}
        </p>
      )}
      <SubmitButton />
    </form>
  );
}
