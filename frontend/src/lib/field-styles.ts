/** Shared text-input styling so every field reacts to focus and errors the same way in both themes. */
export function inputClassName(hasError: boolean): string {
  return `w-full rounded-lg border bg-surface text-sm text-fg shadow-xs outline-none transition placeholder:text-subtle focus:ring-2 dark:bg-sunken dark:focus:bg-raised/60 ${
    hasError ? "border-danger-line focus:border-danger focus:ring-danger/20" : "border-line focus:border-accent focus:ring-accent/25"
  }`;
}

export const fieldLabelClassName = "mb-1.5 block text-xs font-medium text-muted";
