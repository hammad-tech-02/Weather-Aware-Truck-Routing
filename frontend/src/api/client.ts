/**
 * Minimal typed fetch wrapper. The backend always answers errors with
 * `{ error, details? }`, so every non-2xx response is turned into an
 * `ApiError` that carries that message for direct display in the UI.
 */
import { getApiBaseUrl } from "@/config/env";

export class ApiError extends Error {
  readonly status: number;
  readonly details: unknown;

  constructor(message: string, status: number, details?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.details = details;
  }
}

interface RequestOptions {
  method?: "GET" | "POST";
  body?: unknown;
  signal?: AbortSignal;
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = "GET", body, signal } = options;

  let response: Response;
  try {
    response = await fetch(`${getApiBaseUrl()}${path}`, {
      method,
      signal,
      headers: body === undefined ? undefined : { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch (error) {
    // aborts are expected (react query cancels stale requests) and must propagate untouched
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    throw new ApiError("Could not reach the server. Is the backend running?", 0);
  }

  const payload: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    const message =
      isErrorPayload(payload) && payload.error
        ? payload.error
        : `Request failed with status ${response.status}`;
    throw new ApiError(message, response.status, isErrorPayload(payload) ? payload.details : undefined);
  }

  return payload as T;
}

function isErrorPayload(value: unknown): value is { error?: string; details?: unknown } {
  return typeof value === "object" && value !== null && "error" in value;
}

/** User-facing message for any thrown value. */
export function getErrorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message;
  return "Something went wrong.";
}
