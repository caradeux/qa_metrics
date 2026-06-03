export const AUTOMATION_STATUSES = [
  "ACTIVE",
  "MAINTENANCE",
  "PAUSED",
  "DONE",
] as const;

export type AutomationStatus = (typeof AUTOMATION_STATUSES)[number];

// Statuses for which the weekly grid shows the assignment by default.
export const AUTOMATION_OPEN_STATUSES = ["ACTIVE", "MAINTENANCE"] as const;
