/**
 * Typed access to build-time environment variables. Reading them through
 * getters keeps `import.meta.env` out of the rest of the code base.
 */

/** API origin without a trailing slash; empty string means same origin. */
export function getApiBaseUrl(): string {
  return (import.meta.env.VITE_API_BASE_URL ?? "").replace(/\/+$/, "");
}
