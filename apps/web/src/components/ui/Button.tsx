import { ButtonHTMLAttributes } from "react";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" };

export function Button({ variant = "primary", className = "", ...props }: Props) {
  const styles =
    variant === "primary"
      ? "bg-brand-600 text-white hover:bg-brand-700 disabled:bg-brand-300"
      : "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50";

  return (
    <button
      className={`rounded-md px-4 py-2 text-sm font-medium disabled:cursor-not-allowed ${styles} ${className}`}
      {...props}
    />
  );
}
