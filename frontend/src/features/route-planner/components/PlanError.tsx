import { AlertCircle } from "lucide-react";

import { ApiError, getErrorMessage } from "@/api/client";

/** Flattens `{ field: ["msg"] }` style details from the backend into readable lines. */
function detailLines(details: unknown): string[] {
  if (typeof details !== "object" || details === null) return [];
  return Object.entries(details).flatMap(([field, value]) => {
    const messages = Array.isArray(value) ? value : [value];
    return messages
      .filter((message): message is string | number => typeof message === "string" || typeof message === "number")
      .map((message) => `${field.replace(/_/g, " ")}: ${message}`);
  });
}

export function PlanError({ error }: { error: unknown }) {
  const lines = error instanceof ApiError ? detailLines(error.details) : [];
  return (
    <div role="alert" className="flex gap-2.5 rounded-xl bg-danger-soft p-3 text-sm text-danger ring-1 ring-danger-line">
      <AlertCircle className="mt-0.5 size-4 shrink-0" />
      <div className="min-w-0">
        <p className="font-semibold">Could not plan this trip</p>
        <p className="mt-0.5 text-xs opacity-90">{getErrorMessage(error)}</p>
        {lines.length > 0 && (
          <ul className="mt-1 list-disc pl-4 text-xs opacity-90">
            {lines.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
