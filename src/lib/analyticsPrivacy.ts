type AnalyticsEvent = {
  properties: Record<string, unknown>;
  $set?: Record<string, unknown>;
  $set_once?: Record<string, unknown>;
};

const URL_PROPERTY = /(?:^|[_$])(url|uri|href|referrer)(?:$|[_$])/i;

/**
 * Query strings and fragments can carry account-reset, invitation, and other
 * credentials. Analytics only needs the URL path, so omit both by default.
 */
export function sanitizeAnalyticsUrl(url: string): string {
  const sensitivePart = url.search(/[?#]/);
  return sensitivePart === -1 ? url : url.slice(0, sensitivePart);
}

export function sanitizeAnalyticsProperties<T extends Record<string, unknown>>(
  properties: T
): T {
  return Object.fromEntries(
    Object.entries(properties).map(([key, value]) => [
      key,
      typeof value === "string" && URL_PROPERTY.test(key)
        ? sanitizeAnalyticsUrl(value)
        : value,
    ])
  ) as T;
}

export function sanitizeAnalyticsEvent<T extends AnalyticsEvent>(
  event: T | null
): T | null {
  if (!event) return null;
  return {
    ...event,
    properties: sanitizeAnalyticsProperties(event.properties),
    ...(event.$set && { $set: sanitizeAnalyticsProperties(event.$set) }),
    ...(event.$set_once && { $set_once: sanitizeAnalyticsProperties(event.$set_once) }),
  };
}
