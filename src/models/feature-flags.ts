/**
 * Feature flags for runtime behavior overrides
 * Stored in WorkflowState to allow per-issue customization
 */
export interface FeatureFlags {
  /** Skip validation checks */
  skipValidation?: boolean;

  /** Skip security review stage */
  skipSecurityReview?: boolean;

  /** Skip grace period (immediate transition) */
  skipGracePeriod?: boolean;

  /** Enable verbose logging */
  verboseLogging?: boolean;

  /** Dry run mode (no actual GitHub API calls) */
  dryRun?: boolean;

  /** Allow manual stage transitions without completing tasks */
  allowManualTransitions?: boolean;

  /** Disable automatic task creation */
  disableAutomaticTasks?: boolean;
}
