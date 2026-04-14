export const ACTIVE_STATUSES = [
  "REGISTERED",
  "ANALYSIS",
  "TEST_DESIGN",
  "WAITING_QA_DEPLOY",
  "EXECUTION",
] as const;

export const IDLE_STATUSES = [
  "RETURNED_TO_DEV",
  "WAITING_UAT",
  "UAT",
  "PRODUCTION",
  "ON_HOLD",
] as const;

export type AssignmentStatus =
  | (typeof ACTIVE_STATUSES)[number]
  | (typeof IDLE_STATUSES)[number];

export function isActiveStatus(s: string): boolean {
  return (ACTIVE_STATUSES as readonly string[]).includes(s);
}

export function isIdleStatus(s: string): boolean {
  return (IDLE_STATUSES as readonly string[]).includes(s);
}
