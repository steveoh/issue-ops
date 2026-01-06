# Data Model: GitHub Issue Operations Management

**Feature**: 001-github-issue-ops  
**Date**: 2025-12-31  
**Status**: Phase 1 Design

## Overview

This document defines the core entities, relationships, and validation rules for the GitHub Issue Operations Management system. The data model supports five workflow types with multi-stage progression, task assignments, and state persistence in GitHub issue comments.

## Core Entities

### 1. WorkflowState

Represents the current state of a workflow for a specific issue. Stored as JSON in hidden HTML comments on the parent issue.

**Fields**:

- `version: string` - Schema version for migration support (e.g., "1.0")
- `workflowType: WorkflowType` - One of: sgid-addition, sgid-deprecation, app-addition, app-deprecation, internal-sgid-deprecation
- `issueNumber: number` - GitHub issue number for the parent issue
- `resourceName: string` - Name of the resource being managed (layer name, app name, etc.)
- `currentStage: string` - ID of the current workflow stage
- `stageHistory: StageHistoryEntry[]` - Audit trail of stage transitions
- `createdAt: string` - ISO 8601 timestamp of workflow initiation
- `updatedAt: string` - ISO 8601 timestamp of last state update
- `metadata: Record<string, any>` - Workflow-specific data extracted from issue template
- `featureFlags: FeatureFlags` - Runtime behavior overrides
- `gracePeriod?: GracePeriod` - Current grace period if workflow is paused
- `taskIssues: TaskIssue[]` - Child issues created for task assignments
- `status: WorkflowStatus` - Overall workflow status

**Validation Rules**:

- `version` must match known schema versions
- `workflowType` must be one of the five defined types
- `currentStage` must exist in the workflow definition for `workflowType`
- `resourceName` must be non-empty string
- `createdAt` must be valid ISO 8601 timestamp
- `updatedAt` must be >= `createdAt`

**State Transitions**:

```
initiated → in_progress → paused? → in_progress → completed
                                  ↘ failed
```

**Relationships**:

- One WorkflowState per GitHub issue (1:1)
- WorkflowState references multiple TaskIssues (1:N)
- WorkflowState has one WorkflowDefinition based on type (N:1)

---

### 2. WorkflowDefinition

Defines the structure and behavior of a workflow type. Stored as TypeScript configuration objects in code.

**Fields**:

- `type: WorkflowType` - Unique identifier for this workflow
- `name: string` - Human-readable name (e.g., "SGID Addition Request")
- `description: string` - Brief description of workflow purpose
- `stages: Stage[]` - Ordered list of workflow stages
- `transitions: Map<string, StageTransition>` - Valid stage transitions
- `initialStage: string` - Stage ID where workflow starts
- `requiredMetadata: string[]` - Required fields from issue template
- `defaultFeatureFlags: FeatureFlags` - Default flag values

**Validation Rules**:

- `type` must be unique across all workflow definitions
- `initialStage` must exist in `stages` array
- All transition source/target stages must exist in `stages`
- `requiredMetadata` fields must exist in corresponding issue template

**Relationships**:

- WorkflowDefinition has multiple Stages (1:N composition)
- WorkflowDefinition has multiple StageTransitions (1:N composition)
- Multiple WorkflowStates reference one WorkflowDefinition (N:1)

---

### 3. Stage

Represents a discrete step in a workflow with specific completion criteria and task assignments.

**Fields**:

- `id: string` - Unique identifier within workflow (e.g., "initial-review")
- `name: string` - Human-readable stage name (e.g., "Initial Review")
- `description: string` - Detailed description of stage purpose
- `order: number` - Numeric ordering for stage progression
- `assigneeRole: string` - Role of person responsible (e.g., "data-steward")
- `taskTemplate: string` - Template for task issue body
- `gracePeriodDays?: number` - Optional waiting period before proceeding
- `notificationRecipients: string[]` - Email addresses or GitHub handles to notify
- `completionCriteria: string` - Description of what completes this stage
- `isRequired: boolean` - Whether stage can be skipped
- `estimatedDurationDays: number` - Expected time to complete stage

**Validation Rules**:

- `id` must be unique within workflow
- `order` must be unique within workflow
- `assigneeRole` must map to known role in configuration
- `gracePeriodDays` must be >= 0 if present
- `estimatedDurationDays` must be > 0

**Relationships**:

- Stage belongs to one WorkflowDefinition (N:1)
- Stage can have multiple TaskIssues created for it (1:N)

---

### 4. StageTransition

Defines a valid transition from one stage to another with conditions.

**Fields**:

- `fromStage: string` - Source stage ID
- `toStage: string` - Target stage ID
- `event: TransitionEvent` - Event that triggers transition (task_completed, manual_approval, grace_period_expired)
- `condition?: string` - Optional condition expression (e.g., "approvalStatus === 'approved'")
- `automatic: boolean` - Whether transition happens automatically or requires manual trigger

**Validation Rules**:

- `fromStage` and `toStage` must exist in parent workflow
- `fromStage` and `toStage` must be different
- If `automatic` is true, `event` must be observable by the system

**Relationships**:

- StageTransition belongs to one WorkflowDefinition (N:1)
- StageTransition references two Stages (N:2)

---

### 5. TaskIssue

Represents a child GitHub issue created for task assignment. Stored in WorkflowState and tracked via GitHub API.

**Fields**:

- `issueNumber: number` - GitHub issue number for the task
- `stageId: string` - Stage this task belongs to
- `title: string` - Task issue title
- `assignee: string` - GitHub username assigned to task
- `labels: string[]` - GitHub labels applied to task
- `createdAt: string` - ISO 8601 timestamp of task creation
- `completedAt?: string` - ISO 8601 timestamp of task completion (when issue closed)
- `status: TaskStatus` - Current task status

**Validation Rules**:

- `issueNumber` must be positive integer
- `stageId` must match a stage in parent workflow
- `assignee` must be non-empty string
- `completedAt` must be >= `createdAt` if present

**Relationships**:

- TaskIssue belongs to one WorkflowState (N:1)
- TaskIssue belongs to one Stage (N:1)
- TaskIssue references a GitHub Issue (1:1)

---

### 6. StageHistoryEntry

Audit trail entry for stage transitions. Stored in WorkflowState.

**Fields**:

- `stageId: string` - Stage that was entered
- `enteredAt: string` - ISO 8601 timestamp of stage entry
- `exitedAt?: string` - ISO 8601 timestamp of stage exit
- `actor: string` - GitHub username who triggered transition
- `event: TransitionEvent` - Event that caused transition
- `notes?: string` - Optional notes about the transition

**Validation Rules**:

- `stageId` must exist in workflow definition
- `enteredAt` must be valid ISO 8601 timestamp
- `exitedAt` must be >= `enteredAt` if present
- `actor` must be non-empty string

**Relationships**:

- StageHistoryEntry belongs to one WorkflowState (N:1)
- StageHistoryEntry references one Stage (N:1)

---

### 7. GracePeriod

Represents a pause in workflow execution for a specified duration.

**Fields**:

- `startDate: string` - ISO 8601 timestamp when grace period started
- `durationDays: number` - Number of days to pause
- `reason: string` - Explanation for grace period
- `endDate: string` - Calculated ISO 8601 timestamp when grace period ends
- `canSkip: boolean` - Whether grace period can be manually skipped

**Validation Rules**:

- `startDate` must be valid ISO 8601 timestamp
- `durationDays` must be > 0
- `endDate` must equal `startDate` + `durationDays`
- `reason` must be non-empty string

**Relationships**:

- GracePeriod belongs to one WorkflowState (N:1)
- GracePeriod associated with one Stage (N:1)

---

### 8. FeatureFlags

Runtime behavior overrides for workflows. Stored in WorkflowState.

**Fields**:

- `skipGracePeriod?: boolean` - Override grace period requirements
- `forceManualReview?: boolean` - Require manual approval even if automatic
- `enableNotifications?: boolean` - Send email/Slack notifications
- `customAssignee?: string` - Override default assignee for tasks
- `debugMode?: boolean` - Enable verbose logging
- `allowConcurrentTasks?: boolean` - Allow multiple tasks in parallel
- `autoCloseOnComplete?: boolean` - Automatically close issue when workflow completes

**Validation Rules**:

- All fields are optional
- Boolean fields must be true/false if present
- `customAssignee` must be valid GitHub username if present

**Relationships**:

- FeatureFlags embedded in one WorkflowState (1:1 composition)

---

### 9. IssueTemplate

Metadata extracted from GitHub issue template forms. Stored in WorkflowState.metadata.

**Common Fields** (all templates):

- `templateType: WorkflowType` - Which template was used
- `submitter: string` - GitHub username who created the issue
- `submittedAt: string` - ISO 8601 timestamp of issue creation

**SGID Addition Specific**:

- `layerName: string` - Name of the spatial data layer
- `dataSource: string` - Source of the data (internal DB, API, file)
- `updateFrequency: string` - How often data updates
- `contactName: string` - Primary contact for data
- `contactEmail: string` - Contact email address
- `description: string` - Purpose and contents of layer

**SGID Deprecation Specific**:

- `layerName: string` - Name of layer to deprecate
- `deprecationReason: string` - Why layer is being deprecated
- `replacementLayer?: string` - Replacement layer if any
- `stakeholders: string[]` - List of affected users/systems

**Application Addition Specific**:

- `appName: string` - Name of the application
- `productionUrl: string` - Production URL
- `developmentUrl: string` - Development URL
- `primaryContact: string` - Primary contact person
- `sowDocument: string` - Link to Statement of Work
- `billingElcid: string` - Billing ELCID identifier
- `maintenanceContract: string` - Maintenance contract details
- `githubRepository: string` - GitHub repo URL
- `serviceNowAdded: boolean` - Whether added to ServiceNow portfolio

**Application Deprecation Specific**:

- `appName: string` - Name of application to deprecate
- `deprecationReason: string` - Why application is being deprecated
- `activeUsers: number` - Estimated number of active users
- `dependentSystems: string[]` - Systems that depend on this app
- `dataRetention: string` - Data retention requirements

**Internal SGID Deprecation Specific**:

- `layerName: string` - Name of internal layer to deprecate
- `internalUseOnly: boolean` - Confirm internal-only
- `deprecationReason: string` - Why deprecating

**Validation Rules**:

- All required fields must be present based on `templateType`
- Email fields must be valid email format
- URL fields must be valid HTTP/HTTPS URLs
- Boolean fields must be true/false

**Relationships**:

- IssueTemplate data embedded in one WorkflowState (1:1 composition)

---

## Enumerations

### WorkflowType

```typescript
enum WorkflowType {
  SGID_ADDITION = 'sgid-addition',
  SGID_DEPRECATION = 'sgid-deprecation',
  APP_ADDITION = 'app-addition',
  APP_DEPRECATION = 'app-deprecation',
  INTERNAL_SGID_DEPRECATION = 'internal-sgid-deprecation',
}
```

### WorkflowStatus

```typescript
enum WorkflowStatus {
  INITIATED = 'initiated',
  IN_PROGRESS = 'in_progress',
  PAUSED = 'paused',
  COMPLETED = 'completed',
  FAILED = 'failed',
}
```

### TaskStatus

```typescript
enum TaskStatus {
  CREATED = 'created',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
}
```

### TransitionEvent

```typescript
enum TransitionEvent {
  TASK_COMPLETED = 'task_completed',
  MANUAL_APPROVAL = 'manual_approval',
  GRACE_PERIOD_EXPIRED = 'grace_period_expired',
  ERROR_OCCURRED = 'error_occurred',
  MANUAL_SKIP = 'manual_skip',
}
```

## Entity Relationship Diagram (Textual)

```
WorkflowDefinition (1) ────┬──── (N) Stage
                           └──── (N) StageTransition

WorkflowState (1) ────┬──── (N) TaskIssue
                      ├──── (N) StageHistoryEntry
                      ├──── (1) GracePeriod [optional]
                      ├──── (1) FeatureFlags [embedded]
                      ├──── (1) IssueTemplate [embedded]
                      └──── (N:1) WorkflowDefinition [reference]

Stage (1) ────┬──── (N) TaskIssue
              └──── (N) StageHistoryEntry

GitHub Issue (parent) ─── (1) WorkflowState [stored in comment]
GitHub Issue (child) ─── (1) TaskIssue [tracked in state]
```

## Data Storage Strategy

### Primary Storage: GitHub Issue Comments

WorkflowState is serialized to JSON and embedded in HTML comments on the parent issue:

```html
<!--
ISSUE_OPS_STATE_V1
{
  "version": "1.0",
  "workflowType": "sgid-addition",
  "issueNumber": 42,
  "resourceName": "UtahHealthcareProviders",
  "currentStage": "initial-review",
  "stageHistory": [...],
  "createdAt": "2025-12-31T10:00:00Z",
  "updatedAt": "2025-12-31T12:30:00Z",
  "metadata": {...},
  "featureFlags": {...},
  "taskIssues": [...],
  "status": "in_progress"
}
-->
```

**State Update Process**:

1. Fetch issue comments via GitHub API
2. Find comment with `ISSUE_OPS_STATE_V1` marker
3. Parse JSON from comment body
4. Validate against schema
5. Update state in memory
6. Serialize updated state back to JSON
7. Update comment via GitHub API (or create new comment if first time)

**Concurrency Handling**:

- GitHub API provides ETags for optimistic locking
- Use comment edit API with ETag to detect concurrent modifications
- Retry with fresh state if ETag mismatch detected
- Maximum 3 retry attempts before failing

### Optional Storage: Firestore

For analytics and cross-issue queries, optionally persist state to Firestore:

**Collection**: `workflows`  
**Document ID**: `{owner}-{repo}-{issueNumber}`  
**Schema**: Same as WorkflowState

**Indexes**:

- `workflowType` + `status` (for active workflow queries)
- `createdAt` (for time-based analytics)
- `currentStage` (for stage distribution reports)

## Migration Strategy

Schema versioning supports evolution without breaking existing workflows:

**Version Field**: `state.version` (e.g., "1.0", "1.1", "2.0")

**Migration Function**:

```typescript
function migrateState(state: any): WorkflowState {
  switch (state.version) {
    case '1.0':
      return state as WorkflowState; // Current version
    case '0.9':
      // Migrate from beta version
      return {
        ...state,
        version: '1.0',
        featureFlags: state.featureFlags || {},
        status: state.status || WorkflowStatus.IN_PROGRESS,
      };
    default:
      throw new Error(`Unsupported state version: ${state.version}`);
  }
}
```

## Validation Summary

All entities implement validation at these levels:

1. **Type-level**: TypeScript interfaces enforce compile-time type safety
2. **Runtime**: Validation functions check business rules (e.g., date ordering, required fields)
3. **API-level**: GitHub API validates issue structure, labels, assignees
4. **Schema**: JSON schema validation for state serialization/deserialization

Example validation function:

```typescript
function validateWorkflowState(state: WorkflowState): ValidationResult {
  const errors: string[] = [];

  if (!state.version) errors.push('version is required');
  if (!Object.values(WorkflowType).includes(state.workflowType)) {
    errors.push(`Invalid workflowType: ${state.workflowType}`);
  }
  if (new Date(state.updatedAt) < new Date(state.createdAt)) {
    errors.push('updatedAt must be >= createdAt');
  }

  return { valid: errors.length === 0, errors };
}
```

## Next Steps

1. Generate API contracts in `/contracts/` directory
2. Generate `quickstart.md` with setup instructions
3. Update agent context with technology stack
