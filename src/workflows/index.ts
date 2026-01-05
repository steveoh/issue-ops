/**
 * Workflow Registry
 * 
 * Central registry for all workflow definitions.
 * Import and export workflow definitions here.
 */

import type { WorkflowDefinition } from '../models/workflow-definition.js';
import { WorkflowType } from '../models/types.js';
import { sgidDeprecationWorkflow } from './sgid-deprecation.js';

/**
 * Map of workflow types to their definitions
 */
export const workflows = new Map<WorkflowType, WorkflowDefinition>([
  [WorkflowType.SGID_DEPRECATION, sgidDeprecationWorkflow],
  // Add more workflows here as they're implemented:
  // [WorkflowType.SGID_ADDITION, sgidAdditionWorkflow],
  // [WorkflowType.APP_ADDITION, appAdditionWorkflow],
  // [WorkflowType.APP_DEPRECATION, appDeprecationWorkflow],
  // [WorkflowType.INTERNAL_SGID_DEPRECATION, internalSgidDeprecationWorkflow],
]);

/**
 * Get a workflow definition by type
 * @param type - Workflow type
 * @returns Workflow definition or undefined if not found
 */
export function getWorkflow(type: WorkflowType): WorkflowDefinition | undefined {
  return workflows.get(type);
}

/**
 * Get all registered workflow types
 * @returns Array of workflow types
 */
export function getWorkflowTypes(): WorkflowType[] {
  return Array.from(workflows.keys());
}

/**
 * Check if a workflow type is registered
 * @param type - Workflow type to check
 * @returns True if workflow is registered
 */
export function hasWorkflow(type: WorkflowType): boolean {
  return workflows.has(type);
}
