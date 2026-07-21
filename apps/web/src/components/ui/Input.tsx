import { InputHTMLAttributes, forwardRef } from "react";

type Props = InputHTMLAttributes<HTMLInputElement> & { label: string };

export const Input = forwardRef<HTMLInputElement, Props>(function Input(
  { label, id, ...props },
  ref,
) {
  const inputId = id ?? props.name;
  return (
    <div className="space-y-1">
      <label htmlFor={inputId} className="block text-sm font-medium text-slate-700">
        {label}
      </label>
      <input
        ref={ref}
        id={inputId}
        className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
        {...props}
      />
    </div>
  );
});
