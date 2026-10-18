import { WorkItemStatus, TeamRole } from "@/generated/prisma/enums";

/** Server-authoritative allowed transitions */
export const ALLOWED_TRANSITIONS: Record<WorkItemStatus, WorkItemStatus[]> = {
  OPEN: ["IN_PROGRESS"],
  IN_PROGRESS: ["AWAITING_APPROVAL", "OPEN"],
  AWAITING_APPROVAL: ["RESOLVED", "IN_PROGRESS"],
  RESOLVED: ["CLOSED"],
  CLOSED: [],
};

/**
 * Transitions that require LEAD or ADMIN role in the item's team.
 * ADMIN subsumes LEAD within a team (documented in AUTHORIZATION_MATRIX.md).
 */
export const LEAD_REQUIRED_TRANSITIONS: Partial<Record<WorkItemStatus, WorkItemStatus[]>> = {
  AWAITING_APPROVAL: ["RESOLVED", "IN_PROGRESS"], // approve or reject
  RESOLVED: ["CLOSED"],                            // close requires Lead+
};

export function isTransitionAllowed(
  from: WorkItemStatus,
  to: WorkItemStatus
): boolean {
  return ALLOWED_TRANSITIONS[from]?.includes(to) ?? false;
}

/** Returns true if this transition requires LEAD or higher */
export function transitionRequiresLead(
  from: WorkItemStatus,
  to: WorkItemStatus
): boolean {
  return LEAD_REQUIRED_TRANSITIONS[from]?.includes(to) ?? false;
}

export function getAllowedTransitions(
  from: WorkItemStatus,
  userRole: TeamRole
): WorkItemStatus[] {
  const all = ALLOWED_TRANSITIONS[from] ?? [];
  return all.filter((to) => {
    if (transitionRequiresLead(from, to)) {
      return userRole === "LEAD" || userRole === "ADMIN";
    }
    return true;
  });
}

