// Common result shape returned by every service method that can fail
// validation or a business rule — API routes map this straight to a JSON
// response without each endpoint inventing its own error shape.
export type ServiceResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

export function ok<T>(data: T): ServiceResult<T> {
  return { ok: true, data };
}

export function fail<T>(error: string, fieldErrors?: Record<string, string>): ServiceResult<T> {
  return { ok: false, error, fieldErrors };
}

/** Flattens a zod SafeParseError into the field-error map used by ServiceResult. */
export function zodFieldErrors(issues: { path: PropertyKey[]; message: string }[]): Record<string, string> {
  const fieldErrors: Record<string, string> = {};
  for (const issue of issues) {
    const key = issue.path.map(String).join(".") || "_form";
    if (!fieldErrors[key]) fieldErrors[key] = issue.message;
  }
  return fieldErrors;
}
