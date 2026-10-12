import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from "react";

const controlClass =
  "h-10 w-full rounded-lg border border-line bg-surface px-3 text-sm text-foreground outline-none transition-colors placeholder:text-muted/70 focus:border-primary focus:ring-2 focus:ring-primary/20";

function Label({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium">{label}</span>
      {children}
    </label>
  );
}

export function Field({ label, ...input }: { label: string } & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <Label label={label}>
      <input {...input} className={controlClass} />
    </Label>
  );
}

export function SelectField({
  label,
  children,
  ...select
}: { label: string } & SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <Label label={label}>
      <select {...select} className={controlClass}>
        {children}
      </select>
    </Label>
  );
}
