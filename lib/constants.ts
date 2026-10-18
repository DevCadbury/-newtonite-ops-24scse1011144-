/**
 * Client-safe enum constants.
 * Do NOT import from "@/generated/prisma/client" in client components.
 * Use these instead.
 */

export const WorkItemStatuses = [
  "OPEN",
  "IN_PROGRESS",
  "AWAITING_APPROVAL",
  "RESOLVED",
  "CLOSED",
] as const;

export type WorkItemStatusValue = (typeof WorkItemStatuses)[number];

export const WorkItemTypes = [
  "INCIDENT",
  "CUSTOMER_ISSUE",
  "PAYMENT",
  "COMPLIANCE",
  "TASK",
] as const;

export type WorkItemTypeValue = (typeof WorkItemTypes)[number];

export const Priorities = ["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const;

export type PriorityValue = (typeof Priorities)[number];

export const TeamRoles = ["VIEWER", "MEMBER", "LEAD", "ADMIN"] as const;

export type TeamRoleValue = (typeof TeamRoles)[number];
