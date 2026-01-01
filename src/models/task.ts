import { TaskStatus } from './types.js';

/**
 * Represents a task issue created as part of a workflow stage
 */
export interface TaskIssue {
  /** GitHub issue number */
  number: number;

  /** Task title */
  title: string;

  /** Current status */
  status: TaskStatus;

  /** Assigned GitHub username */
  assignee?: string;

  /** Parent workflow issue number */
  parentIssue: number;

  /** Stage this task belongs to */
  stage: string;

  /** ISO 8601 timestamp when task was created */
  createdAt: string;

  /** ISO 8601 timestamp when task was completed */
  completedAt?: string;

  /** URL to the task issue */
  url: string;
}

/**
 * Historical record of stage transitions
 * Useful for auditing and debugging workflow progression
 */
export interface StageHistoryEntry {
  /** Stage name */
  stage: string;

  /** Event that triggered entry to this stage */
  entryEvent: string;

  /** ISO 8601 timestamp when stage started */
  startedAt: string;

  /** ISO 8601 timestamp when stage ended */
  endedAt?: string;

  /** GitHub username who triggered the transition */
  triggeredBy?: string;

  /** Optional notes about this stage execution */
  notes?: string;
}

/**
 * Grace period tracking for deprecation workflows
 */
export interface GracePeriod {
  /** Number of days for grace period */
  days: number;

  /** ISO 8601 timestamp when grace period started */
  startedAt: string;

  /** ISO 8601 timestamp when grace period ends */
  endsAt: string;

  /** Whether grace period has been manually cancelled */
  cancelled?: boolean;

  /** Optional reason for cancellation */
  cancellationReason?: string;
}
