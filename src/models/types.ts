/**
 * Core type system for workflow orchestration
 */

/**
 * Supported workflow types
 * MVP: Only SGID_DEPRECATION
 * Future: SGID_ADDITION, APP_ADDITION, APP_DEPRECATION, INTERNAL_SGID_DEPRECATION
 */
export enum WorkflowType {
  SGID_DEPRECATION = 'sgid-deprecation',
  // SGID_ADDITION = 'sgid-addition', // Post-MVP
  // APP_ADDITION = 'app-addition', // Post-MVP
  // APP_DEPRECATION = 'app-deprecation', // Post-MVP
  // INTERNAL_SGID_DEPRECATION = 'internal-sgid-deprecation', // Post-MVP
}

/**
 * Overall workflow status
 */
export enum WorkflowStatus {
  /** Workflow is actively progressing through stages */
  ACTIVE = 'active',
  /** Workflow is temporarily paused (e.g., grace period) */
  PAUSED = 'paused',
  /** Workflow has completed successfully */
  COMPLETED = 'completed',
  /** Workflow was cancelled before completion */
  CANCELLED = 'cancelled',
  /** Workflow encountered an error and cannot proceed */
  FAILED = 'failed',
}

/**
 * Individual stage status within a workflow
 */
export enum StageStatus {
  /** Stage has not started yet */
  PENDING = 'pending',
  /** Stage is currently active with tasks in progress */
  IN_PROGRESS = 'in_progress',
  /** All stage tasks completed, ready to transition */
  COMPLETED = 'completed',
  /** Stage is blocked and cannot proceed */
  BLOCKED = 'blocked',
  /** Stage was skipped via manual override */
  SKIPPED = 'skipped',
}

/**
 * Task issue status (mirrors GitHub issue state)
 */
export enum TaskStatus {
  /** Task issue is open and pending work */
  OPEN = 'open',
  /** Task is being actively worked on */
  IN_PROGRESS = 'in_progress',
  /** Task issue has been closed/completed */
  COMPLETED = 'completed',
  /** Task was cancelled and will not be completed */
  CANCELLED = 'cancelled',
}

/**
 * Events that can trigger stage transitions
 */
export enum TransitionEvent {
  /** All tasks in current stage are completed */
  TASK_COMPLETED = 'task_completed',
  /** Grace period time has expired */
  GRACE_PERIOD_EXPIRED = 'grace_period_expired',
  /** Manual override/skip by authorized user */
  MANUAL_OVERRIDE = 'manual_override',
  /** Manual skip of current stage */
  MANUAL_SKIP = 'manual_skip',
  /** External validation passed */
  VALIDATION_PASSED = 'validation_passed',
  /** Workflow encountered an error */
  ERROR = 'error',
}

/**
 * Roles that can be assigned to stage tasks
 * These map to actual GitHub usernames via configuration
 */
export enum AssigneeRole {
  /** Data governance and stewardship */
  DATA_STEWARD = 'data-steward',
  /** Technical architecture and implementation */
  TECHNICAL_LEAD = 'technical-lead',
  /** Security review and compliance */
  SECURITY_REVIEWER = 'security-reviewer',
  /** No human assignment needed (automated stage) */
  AUTOMATED = 'automated',
}
