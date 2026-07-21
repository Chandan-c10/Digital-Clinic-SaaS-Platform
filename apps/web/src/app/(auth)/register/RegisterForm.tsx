"use client";

import { useFormState, useFormStatus } from "react-dom";
import { registerClinicAction } from "../actions";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} className="w-full">
      {pending ? "Creating your clinic…" : "Start free trial"}
    </Button>
  );
}

export function RegisterForm() {
  const [state, formAction] = useFormState(registerClinicAction, {
    error: undefined as string | undefined,
  });

  return (
    <form action={formAction} className="space-y-4">
      <Input label="Clinic name" name="clinicName" required placeholder="Sunrise Family Clinic" />
      <Input
        label="Choose your web address"
        name="slug"
        required
        pattern="[a-z0-9-]{3,63}"
        placeholder="sunrise"
      />
      <p className="-mt-2 text-xs text-slate-500">yourclinic.platform.com</p>
      <Input label="Your name" name="ownerName" required placeholder="Dr. Anjali Rao" />
      <Input label="Email" name="email" type="email" required autoComplete="email" />
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
