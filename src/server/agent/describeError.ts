// What the agent's error paths write to the server log. Hosting logs are a
// subprocessor's storage (Privacy Policy section 2, "service logs"), and an
// SDK or database error object can carry the request that failed -- a
// question, tool arguments, message text. Only the error's name and
// message are logged, never the object itself.
export function describeError(err: unknown): string {
  if (err instanceof Error) {
    return `${err.name}: ${err.message}`;
  }
  return `Non-Error value thrown (${typeof err})`;
}
