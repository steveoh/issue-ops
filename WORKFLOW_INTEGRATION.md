# SGID Deprecation Workflow - Integration Guide

## Overview

The SGID deprecation workflow has been successfully integrated into the issue-ops system. When a new deprecation issue is opened, the system will automatically:

1. Validate the issue data
2. Initialize the workflow state
3. Create task issues for the first stage (soft delete)
4. Track progress as tasks are completed

## Architecture

### Key Components

- **`src/workflows/sgid-deprecation.ts`** - Complete 5-phase workflow definition (942 lines)
  - Phase 1: Initial validation (automatic)
  - Phase 2: Soft delete (8 tasks)
  - Phase 3: Validation + 14-day grace period (5 tasks)
  - Phase 4: Hard delete (8 tasks)
  - Phase 5: Final validation (4 tasks)

- **`src/main.ts`** - Entry point that orchestrates workflow initialization
- **`src/services/workflow-orchestrator.ts`** - Manages workflow state transitions
- **`src/services/task-manager.ts`** - Creates and tracks child task issues
- **`src/services/state-manager.ts`** - Persists state in issue comments
- **`src/services/task-nagger.ts`** - Weekly Monday morning reminders

### Workflow Flow

```txt
Issue Opened (deprecation label)
    ↓
Validation (automatic)
    ↓
Initialize Workflow State
    ↓
Transition to Soft Delete Stage
    ↓
Create 8 Task Issues
    ↓
[Wait for tasks to be completed]
    ↓
Transition to Validation Stage
    ↓
Start 14-day Grace Period
    ↓
[Continue through remaining stages...]
```

## Field Mapping

The issue template (`.github/ISSUE_TEMPLATE/deprecate.yaml`) uses these field IDs:

- `display-name` → `{{layerName}}`
- `deprecation-reason` → `{{reason}}`
- `migration-guide` → `{{migrationGuide}}`
- `internal-sgid-table` → `{{internalSgidTable}}`
- `open-sgid-table` → `{{openSgidTable}}`
- `arcgis-online-id` → `{{agolItemId}}` (schema expects `arcgis-online-item-id`)
- `gis-utah-gov-url` → `{{productPageUrl}}` (schema expects `product-page-url`)
- `sgid-index-id` → `{{sgidIndexId}}`
- `archives-record-series` → `{{archivesRecordSeries}}`

### Variable Interpolation

Task templates use `{{variable}}` syntax which gets replaced with actual values:

```markdown
Update the [SGID Index](https://docs.google.com/.../{{sgidIndexId}}) deprecation field...
```

Becomes:

```markdown
Update the [SGID Index](https://docs.google.com/.../550e8400-e29b-41d4-a716-446655440000) deprecation field...
```

## State Storage

Workflow state is stored as JSON in an HTML comment on the parent issue:

```html
<!--
WORKFLOW_STATE:v1
{
  "version": 1,
  "workflowType": "SGID_DEPRECATION",
  "status": "IN_PROGRESS",
  "currentStage": "soft-delete",
  "taskIssues": [
    {"number": 1001, "title": "Update metadata fields...", "status": "OPEN"},
    ...
  ],
  "createdAt": "2024-01-05T12:00:00Z",
  "updatedAt": "2024-01-05T12:00:00Z"
}
-->

## 📊 Workflow Progress **Stage:** Soft Delete (Phase 2/5) **Status:** In
Progress **Last Updated:** 2024-01-05 12:00 PM ### Tasks (0/8 complete) - [ ]
Update metadata fields in Internal SGID (#1001) - [ ] Update metadata fields in
Open SGID (#1002) ...
```

## Stage Definitions

### Phase 2: Soft Delete (8 tasks)

- Update metadata in Internal/Open SGID
- Update SGID Index deprecation field
- Update product page
- Unshare from ArcGIS Online
- Tweet deprecation notice
- Post to social channels
- Create shelflife reference
- Post deprecation comment

### Phase 3: Validation + Grace Period (5 tasks)

- Verify metadata updated
- Verify SGID Index updated
- Verify product page updated
- Verify AGOL unshared
- 14-day automatic pause

### Phase 4: Hard Delete (8 tasks)

- Drop tables from Internal/Open SGID
- Delete AGOL items
- Delete Hub items
- Archive or delete data
- Remove from index
- Update product page archives section
- Final tweet
- Close issue

### Phase 5: Final Validation (4 tasks)

- Verify tables dropped
- Verify AGOL deleted
- Verify archives created
- Verify all metadata updated

## Assignees

Tasks are automatically assigned based on workflow configuration:

- **Erik** (`@eneemann`) - Data steward tasks (shelf decision, SGID changes)
- **Steve** (`@steveoh`) - Social media tasks (tweets, posts)
- All other tasks: No default assignee (can be self-assigned)

## Labels

The workflow uses these labels to track state:

- `state: soft delete` - Currently in phase 2
- `state: soft delete validation` - Currently in phase 3
- `state: hard delete` - Currently in phase 4
- `state: hard delete validation` - Currently in phase 5
- `status: waiting` - Paused (e.g., grace period)
- `status: in progress` - Actively working
- `status: blocked` - Needs attention
- `type: full deprecation` - All SGID products
- `type: internal/open sgid deprecation` - SGID databases only
- `type: full circle deprecation` - Full lifecycle back to manual

## Future Enhancements

These features are defined but not yet implemented:

1. **Task Completion Detection** - Listen for task issue closures
2. **Automatic Stage Transitions** - Move to next stage when all tasks complete
3. **Grace Period Countdown** - Daily updates showing days remaining
4. **Complaint Detection** - Pause workflow on 🙁 emoji reactions
5. **Approval Mechanism** - Require thumbs-up for shelf decision
6. **Weekly Nagging** - Monday morning reminders for incomplete tasks

## Troubleshooting

### Workflow doesn't initialize

Check that:

1. Issue has `deprecation` label
2. Issue body contains required fields (display-name, internal-sgid-table, etc.)
3. Validation passes (no errors in validation comment)
4. GitHub token has correct permissions

### Tasks not created

Check that:

1. Workflow initialized successfully (state comment exists)
2. Stage has tasks defined in workflow definition
3. GitHub API permissions allow creating issues

### Variables not interpolating

Check that:

1. Field names match expected schema (use hyphens not underscores)
2. Issue body has correct markdown headers (`### Display Name`)
3. Values are not empty or `_No response_`

## Development Notes

### Adding New Workflows

1. Create workflow definition in `src/workflows/your-workflow.ts`
2. Register in `src/workflows/index.ts`
3. Add detection logic to `src/services/template-detector.ts`
4. Define issue template in `.github/ISSUE_TEMPLATE/`

### Modifying Tasks

Edit the workflow definition in `src/workflows/sgid-deprecation.ts`. Each task has:

```typescript
{
  title: 'Task title with {{variable}}',
  body: 'Task body markdown...',
  assignee: 'username', // optional
  labels: ['task'], // optional
}
```

### Testing Changes

```bash
npm run build  # Compile TypeScript
npm test       # Run all tests (133 tests)
./test-workflow.sh  # Test workflow initialization
```
