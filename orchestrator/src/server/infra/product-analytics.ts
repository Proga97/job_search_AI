/**
 * Product telemetry is intentionally disabled in Meow AI.
 *
 * The function remains as a stable integration seam for existing callers, but
 * no profile, job, application, or usage data leaves the local installation.
 */
export async function trackServerProductEvent(
  _event: string,
  _data?: Record<string, unknown>,
  _options?: {
    distinctId?: string | null;
    occurredAt?: Date | number | string | null;
    requestOrigin?: string | null;
    requestUserAgent?: string | null;
    sessionId?: string | null;
    urlPath?: string;
  },
): Promise<boolean> {
  return false;
}
