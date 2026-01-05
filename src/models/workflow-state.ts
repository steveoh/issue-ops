import {
  StageStatus,
  TransitionEvent,
  WorkflowStatus,
  WorkflowType,
  TaskStatus,
} from './types.js';
import type { TaskIssue } from './task.js';

/**
 * Complete workflow state - persisted in GitHub issue comment as JSON
 * This represents the entire state of a workflow at any point in time
 */
export interface WorkflowState {
  /** Schema version for state format (enables migrations) */
  version: string;

  /** Type of workflow being executed */
  workflowType: WorkflowType;

  /** Parent GitHub issue number */
  issueNumber: number;

  /** Overall workflow status */
  status: WorkflowStatus;

  /** Current active stage name */
  currentStage: string;

  /** Parsed data from the issue template */
  data: Record<string, unknown>;

  /** State of each workflow stage */
  stages: Record<string, StageState>;

  /** Optional feature flags for behavior overrides */
  featureFlags?: Record<string, boolean>;

  /** ISO 8601 timestamp when workflow was created */
  createdAt: string;

  /** ISO 8601 timestamp when state was last updated */
  updatedAt: string;
}

/**
 * State of an individual stage within a workflow
 */
export interface StageState {
  /** Stage name (matches Stage.name in workflow definition) */
  name: string;

  /** Current status of this stage */
  status: StageStatus;

  /** GitHub username assigned to this stage (if applicable) */
  assignee?: string;

  /** Task issues created for this stage */
  taskIssues?: TaskIssue[];

  /** ISO 8601 timestamp when stage started */
  startedAt?: string;

  /** ISO 8601 timestamp when stage completed */
  completedAt?: string;

  /** Grace period end date (if applicable) */
  gracePeriodEndsAt?: string;

  /** Optional notes or metadata for this stage */
  notes?: string;
}

/**
 * Validation result structure (from existing schema.ts)
 * Kept for compatibility with current validation system
 */
export interface ValidationResult {
  success: boolean;
  errors?: {
    formErrors: string[];
    fieldErrors: Record<string, string[] | undefined>;
  };
  data?: {
    displayName: string;
    discovery: {
      data: string[][];
      warnings: string[];
    };
    arcgisOnline: {
      data: string[][];
      warnings: string[];
    };
  };
}
