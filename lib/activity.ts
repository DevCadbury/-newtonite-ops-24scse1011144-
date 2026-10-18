import { ActivityEventType } from "@/generated/prisma/enums";

export interface ActivityEventInput {
  workItemId: string;
  actorId: string;
  type: ActivityEventType;
  description: string;
  metadata?: Record<string, unknown>;
}

export function buildActivityEvent(
  workItemId: string,
  actorId: string,
  type: ActivityEventType,
  description: string,
  metadata?: Record<string, unknown>
): ActivityEventInput {
  return { workItemId, actorId, type, description, metadata };
}

