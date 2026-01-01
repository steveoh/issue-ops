import { TransitionEvent, WorkflowType } from './types.js';
import type { WorkflowState } from './workflow-state.js';

/**
 * Complete definition of a workflow including all stages and transitions
 */
export interface WorkflowDefinition {
  /** Workflow type identifier */
  type: WorkflowType;

  /** Human-readable workflow name */
  name: string;

  /** Description of what this workflow does */
  description: string;

  /** Ordered list of stages in this workflow */
  stages: Stage[];
}

/**
 * A single stage within a workflow
 */
export interface Stage {
  /** Unique stage identifier within this workflow */
  name: string;

  /** Human-readable stage description */
  description: string;

  /** Role assigned to this stage (maps to GitHub username via config) */
  assigneeRole: string;

  /** Task templates to create when this stage starts */
  tasks: TaskTemplate[];

  /** Possible transitions to other stages */
  transitions: StageTransition[];

  /** Optional grace period in days (pauses workflow) */
  gracePeriodDays?: number;

  /** Whether this stage can be skipped manually */
  allowManualSkip?: boolean;
}

/**
 * Template for creating task issues
 */
export interface TaskTemplate {
  /** Task issue title (supports {{variable}} interpolation) */
  title: string;

  /** Task issue body in Markdown (supports {{variable}} interpolation) */
  body: string;

  /** Labels to apply to task issue */
  labels: string[];

  /** Optional GitHub username to assign (overrides stage assigneeRole) */
  assignee?: string;
}

/**
 * Defines how to transition from one stage to another
 */
export interface StageTransition {
  /** Event that triggers this transition */
  event: TransitionEvent;

  /** Target stage name to transition to */
  targetStage: string;

  /** Optional condition function (receives current state) */
  condition?: (state: WorkflowState) => boolean;

  /** Optional actions to perform during transition */
  actions?: TransitionAction[];
}

/**
 * Action to perform during a stage transition
 */
export interface TransitionAction {
  /** Action type */
  type: 'add_label' | 'remove_label' | 'post_comment' | 'notify';

  /** Action-specific payload */
  payload: Record<string, unknown>;
}
