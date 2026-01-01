/**
 * Workflow Definitions Contract
 * 
 * This file defines the TypeScript interfaces and types for workflow definitions.
 * These contracts serve as the API between workflow configuration and execution engine.
 */

export enum WorkflowType {
  SGID_ADDITION = 'sgid-addition',
  SGID_DEPRECATION = 'sgid-deprecation',
  APP_ADDITION = 'app-addition',
  APP_DEPRECATION = 'app-deprecation',
  INTERNAL_SGID_DEPRECATION = 'internal-sgid-deprecation',
}

export enum WorkflowStatus {
  INITIATED = 'initiated',
  IN_PROGRESS = 'in_progress',
  PAUSED = 'paused',
  COMPLETED = 'completed',
  FAILED = 'failed',
}

export enum TaskStatus {
  CREATED = 'created',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
}

export enum TransitionEvent {
  TASK_COMPLETED = 'task_completed',
  MANUAL_APPROVAL = 'manual_approval',
  GRACE_PERIOD_EXPIRED = 'grace_period_expired',
  ERROR_OCCURRED = 'error_occurred',
  MANUAL_SKIP = 'manual_skip',
}

export interface WorkflowDefinition {
  /** Unique identifier for this workflow type */
  type: WorkflowType;
  
  /** Human-readable workflow name */
  name: string;
  
  /** Brief description of workflow purpose */
  description: string;
  
  /** Ordered list of workflow stages */
  stages: Stage[];
  
  /** Valid stage transitions */
  transitions: StageTransition[];
  
  /** Stage ID where workflow starts */
  initialStage: string;
  
  /** Required metadata fields from issue template */
  requiredMetadata: string[];
  
  /** Default feature flag values */
  defaultFeatureFlags: FeatureFlags;
}

export interface Stage {
  /** Unique identifier within workflow */
  id: string;
  
  /** Human-readable stage name */
  name: string;
  
  /** Detailed description of stage purpose */
  description: string;
  
  /** Numeric ordering for stage progression */
  order: number;
  
  /** Role of person responsible (maps to config) */
  assigneeRole: string;
  
  /** Template for task issue body (supports {{variables}}) */
  taskTemplate: string;
  
  /** Optional waiting period before proceeding (in days) */
  gracePeriodDays?: number;
  
  /** GitHub handles or emails to notify when stage begins */
  notificationRecipients: string[];
  
  /** Description of what completes this stage */
  completionCriteria: string;
  
  /** Whether stage can be skipped */
  isRequired: boolean;
  
  /** Expected time to complete stage (in days) */
  estimatedDurationDays: number;
}

export interface StageTransition {
  /** Source stage ID */
  fromStage: string;
  
  /** Target stage ID */
  toStage: string;
  
  /** Event that triggers this transition */
  event: TransitionEvent;
  
  /** Optional condition expression (evaluated as JavaScript) */
  condition?: string;
  
  /** Whether transition happens automatically */
  automatic: boolean;
}

export interface FeatureFlags {
  /** Override grace period requirements */
  skipGracePeriod?: boolean;
  
  /** Require manual approval even if automatic */
  forceManualReview?: boolean;
  
  /** Send email/Slack notifications */
  enableNotifications?: boolean;
  
  /** Override default assignee for tasks */
  customAssignee?: string;
  
  /** Enable verbose logging */
  debugMode?: boolean;
  
  /** Allow multiple tasks in parallel */
  allowConcurrentTasks?: boolean;
  
  /** Automatically close issue when workflow completes */
  autoCloseOnComplete?: boolean;
}

export interface WorkflowState {
  /** Schema version for migration support */
  version: string;
  
  /** Type of workflow */
  workflowType: WorkflowType;
  
  /** GitHub issue number for the parent issue */
  issueNumber: number;
  
  /** Name of the resource being managed */
  resourceName: string;
  
  /** ID of the current workflow stage */
  currentStage: string;
  
  /** Audit trail of stage transitions */
  stageHistory: StageHistoryEntry[];
  
  /** ISO 8601 timestamp of workflow initiation */
  createdAt: string;
  
  /** ISO 8601 timestamp of last state update */
  updatedAt: string;
  
  /** Workflow-specific data extracted from issue template */
  metadata: Record<string, any>;
  
  /** Runtime behavior overrides */
  featureFlags: FeatureFlags;
  
  /** Current grace period if workflow is paused */
  gracePeriod?: GracePeriod;
  
  /** Child issues created for task assignments */
  taskIssues: TaskIssue[];
  
  /** Overall workflow status */
  status: WorkflowStatus;
}

export interface StageHistoryEntry {
  /** Stage that was entered */
  stageId: string;
  
  /** ISO 8601 timestamp of stage entry */
  enteredAt: string;
  
  /** ISO 8601 timestamp of stage exit */
  exitedAt?: string;
  
  /** GitHub username who triggered transition */
  actor: string;
  
  /** Event that caused transition */
  event: TransitionEvent;
  
  /** Optional notes about the transition */
  notes?: string;
}

export interface GracePeriod {
  /** ISO 8601 timestamp when grace period started */
  startDate: string;
  
  /** Number of days to pause */
  durationDays: number;
  
  /** Explanation for grace period */
  reason: string;
  
  /** ISO 8601 timestamp when grace period ends */
  endDate: string;
  
  /** Whether grace period can be manually skipped */
  canSkip: boolean;
}

export interface TaskIssue {
  /** GitHub issue number for the task */
  issueNumber: number;
  
  /** Stage this task belongs to */
  stageId: string;
  
  /** Task issue title */
  title: string;
  
  /** GitHub username assigned to task */
  assignee: string;
  
  /** GitHub labels applied to task */
  labels: string[];
  
  /** ISO 8601 timestamp of task creation */
  createdAt: string;
  
  /** ISO 8601 timestamp of task completion */
  completedAt?: string;
  
  /** Current task status */
  status: TaskStatus;
}

/**
 * Workflow execution context provided to stage logic
 */
export interface WorkflowContext {
  /** Current workflow state */
  state: WorkflowState;
  
  /** Workflow definition */
  definition: WorkflowDefinition;
  
  /** GitHub API client (authenticated) */
  github: any; // Octokit instance
  
  /** Logger instance */
  logger: {
    info(message: string, meta?: any): void;
    warn(message: string, meta?: any): void;
    error(message: string, meta?: any): void;
    debug(message: string, meta?: any): void;
  };
}

/**
 * Result of workflow execution
 */
export interface WorkflowExecutionResult {
  /** Whether execution was successful */
  success: boolean;
  
  /** Updated workflow state */
  state: WorkflowState;
  
  /** Human-readable message describing result */
  message: string;
  
  /** Error details if execution failed */
  error?: {
    code: string;
    message: string;
    recoverable: boolean;
  };
}

/**
 * Validation result for workflow state or definition
 */
export interface ValidationResult {
  /** Whether validation passed */
  valid: boolean;
  
  /** List of validation errors */
  errors: string[];
  
  /** List of validation warnings (non-blocking) */
  warnings?: string[];
}
