import { AlertCircle } from "lucide-react";

/**
 * An inline field error: an icon and the text (never colour alone). Give it an `id` and point the field at it with
 * `aria-describedby`, together with `aria-invalid`.
 */
export function FieldError({ id, children }: { id?: string; children: React.ReactNode }) {
  return (
    <p id={id} role="alert" className="flex items-start gap-1.5 text-meta text-danger">
      <AlertCircle className="mt-px size-4 shrink-0" aria-hidden="true" />
      <span>{children}</span>
    </p>
  );
}
