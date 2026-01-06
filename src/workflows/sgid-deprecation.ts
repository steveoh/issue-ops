import {
  AssigneeRole,
  TransitionEvent,
  WorkflowType,
} from '../models/types.js';
import type {
  Stage,
  WorkflowDefinition,
} from '../models/workflow-definition.js';

/**
 * SGID Deprecation Workflow Definition
 *
 * Complete removal process for SGID layers across all platforms.
 *
 * Stages:
 * 1. First Issue - Validate all required information
 * 2. Soft Delete - Modify metadata and hide data
 * 3. Validate Soft Delete - 14-day grace period + verification
 * 4. Hard Delete - Actual removal from all systems
 * 5. Validate Hard Delete - Final verification
 */

/**
 * Stage 1: First Issue (Validation)
 * Validates that all required information is present before proceeding
 */
const firstIssueStage: Stage = {
  name: 'first-issue',
  description: 'Validate all required deprecation information',
  assigneeRole: AssigneeRole.AUTOMATED,
  tasks: [], // No tasks - automated validation
  transitions: [
    {
      event: TransitionEvent.VALIDATION_PASSED,
      targetStage: 'soft-delete',
      actions: [
        {
          type: 'add_label',
          payload: { label: 'state: soft delete' },
        },
      ],
    },
  ],
};

/**
 * Stage 2: Soft Delete
 * Modify metadata, hide data, but don't remove anything yet
 */
const softDeleteStage: Stage = {
  name: 'soft-delete',
  description: 'Modify metadata and hide data across all platforms',
  assigneeRole: AssigneeRole.DATA_STEWARD,
  tasks: [
    {
      title: 'Update ArcGIS Online Item for {{layerName}}',
      body: `## Update AGOL Item

**Layer**: {{layerName}}
**AGOL Item ID**: {{agolItemId}}

### Tasks:
- [ ] Append " (Mature Support)" to item title
- [ ] Change Authoritative status to 'd' (deprecated)
- [ ] Remove all tags except "Deprecated"
- [ ] Add migration notes to description:
  \`\`\`
  ${'{'}{{migrationGuide}}
  \`\`\`

### Links:
- [AGOL Item](https://www.arcgis.com/home/item.html?id={{agolItemId}})

**Note**: After 24 hours, this item will be unshared from the SGID group.`,
      labels: ['[ ]', 'agol', 'soft-delete'],
    },
    {
      title: 'Update gis.utah.gov for {{layerName}}',
      body: `## Update Website

**Layer**: {{layerName}}
**Product Page**: {{productPageUrl}}

### Tasks:
- [ ] Delete product page from website
- [ ] Remove from downloadMetadata file
- [ ] Add redirect from old URL to replacement (manual - determine best redirect location)

### Repository:
Create a PR in the [gis.utah.gov repository](https://github.com/agrc/gis.utah.gov) to make these changes.`,
      labels: ['[ ]', 'website', 'soft-delete'],
    },
    {
      title: 'Update SGID Index for {{layerName}}',
      body: `## Update SGID Index

**Layer**: {{layerName}}
**Index ID**: {{sgidIndexId}}

### Tasks:
- [ ] Set porterUrl to this issue (#{{issueNumber}})
- [ ] Set indexStatus to "removed"
- [ ] Set refreshCycle to "static"

### Links:
- [SGID Index Entry](https://docs.google.com/spreadsheets/d/{{sgidIndexId}})`,
      labels: ['[ ]', 'sgid-index', 'soft-delete'],
    },
    {
      title: 'Unshare {{layerName}} from SGID Group (After 24 hours)',
      body: `## Unshare from SGID

**Layer**: {{layerName}}
**AGOL Item**: {{agolItemId}}

### Tasks:
- [ ] Wait 24 hours after AGOL item updates
- [ ] Unshare item from SGID group

**Important**: Do not complete this until 24 hours have passed since the AGOL item was updated.`,
      labels: ['[ ]', 'agol', 'soft-delete', 'delayed'],
    },
    {
      title: 'Shelf Decision for {{layerName}}',
      body: `## Shelf Decision

**Layer**: {{layerName}}
**Assigned to**: Data Coordinator (Erik)

### Question:
Should this data be shelved (archived for potential future use)?

- [ ] **Yes** - Data has historical or potential future value
- [ ] **No** - Data can be permanently deleted

### Discussion:
1. Add comments below with your reasoning
2. Tag relevant stakeholders for input
3. React with 👍 to indicate approval
4. **Required**: Minimum of [X] 👍 reactions to proceed

### Decision Process:
Once the required approvals are received and decision is documented, close this issue to proceed.

**Note**: This decision affects the hard delete phase. If "Yes", data will be archived; if "No", data will be permanently deleted.`,
      labels: ['[ ]', 'decision', 'soft-delete', 'approval-required'],
      // assignee: '@eneemann'
    },
    {
      title: 'Post Deprecation Tweet for {{layerName}}',
      body: `## Social Media Notification (Optional)

**Layer**: {{layerName}}
**Assigned to**: @steveoh

### Tasks:
- [ ] Post tweet on X (Twitter) announcing deprecation
- [ ] Include migration guide link
- [ ] Tag relevant accounts if applicable
- [ ] **If posted**: Check here → [ ] Tweet posted
- [ ] **If skipped**: Check here → [ ] Tweet not needed

### Suggested Tweet:
\`\`\`
📢 SGID Layer Deprecation Notice

{{layerName}} is being deprecated.

{{migrationGuide}}

Questions? Contact us at [contact info]
\`\`\`

**Note**: This task is optional. If not posting, mark as "Tweet not needed" and close.`,
      labels: ['[ ]', 'social-media', 'soft-delete', 'optional'],
      assignee: 'steveoh',
    },
    {
      title: 'Check and Migrate Known Usages for {{layerName}}',
      body: `## Known Usages

**Layer**: {{layerName}}

### Check These Systems:
- [ ] API Search endpoint
- [ ] Basemaps
- [ ] Forklift pallet
- [ ] AGOL FS Queries
- [ ] Next Gen 911 Aware Map
- [ ] Other Dependencies

### How to Check:
- Search the [GitHub organization](https://github.com/agrc) for "{{layerName}}" or "{{internalSgidTable}}"
- Check each system manually for references
- Document findings in comments below

### For Each Usage Found:
1. Document the usage location
2. Update to use replacement layer (if applicable)
3. Test the migration
4. Add comment with migration status

### Verification:
Once all systems are checked and usages migrated or documented, close this issue.`,
      labels: ['[ ]', 'migration', 'soft-delete'],
    },
    {
      title:
        'Update SGID (ArcGIS Server) Tags and Description for {{layerName}}',
      body: `## Update SGID Feature Service Metadata

**Layer**: {{layerName}}
**System**: SGID on ArcGIS Server (different from ArcGIS Online)

### Tasks:
- [ ] Remove all tags except "Deprecated"
- [ ] Add migration notes to description:
  \`\`\`markdown
  This layer has been deprecated.

  ${'{'}{{migrationGuide}}
  \`\`\`

### Notes:
- This affects the SGID feature service on ArcGIS Server
- Process is similar to AGOL but uses a different interface
- Ensure migration notes are in Markdown format`,
      labels: ['[ ]', 'sgid', 'soft-delete'],
    },
  ],
  transitions: [
    {
      event: TransitionEvent.TASK_COMPLETED,
      targetStage: 'validate-soft-delete',
      actions: [
        {
          type: 'add_label',
          payload: { label: 'state: soft delete validation' },
        },
        {
          type: 'remove_label',
          payload: { label: 'state: soft delete' },
        },
        {
          type: 'post_comment',
          payload: {
            body: '## 🎯 Soft Delete Complete\n\nAll soft delete tasks have been completed. Starting 14-day grace period for validation and community feedback.',
          },
        },
      ],
    },
  ],
};

/**
 * Stage 3: Validate Soft Delete
 * 14-day grace period followed by validation checks
 *
 * Features:
 * - Automatic 14-day pause (configurable via feature flags)
 * - Daily countdown update in workflow state comment
 * - Complaint detection via 🚨 emoji reactions (pauses workflow)
 * - Validation tasks created after grace period expires
 */
const validateSoftDeleteStage: Stage = {
  name: 'validate-soft-delete',
  description:
    '14-day grace period followed by validation of soft delete changes',
  assigneeRole: AssigneeRole.DATA_STEWARD,
  gracePeriodDays: 14, // Default, can be overridden per issue
  tasks: [
    {
      title: 'Verify AGOL Updates for {{layerName}}',
      body: `## Verify ArcGIS Online Changes

**Layer**: {{layerName}}
**AGOL Item**: {{agolItemId}}

### Verification Checklist:
- [ ] Item title includes "(Mature Support)"
- [ ] Authoritative status is 'd'
- [ ] Only "Deprecated" tag remains
- [ ] Migration notes added to description
- [ ] Item unshared from SGID group

### Links:
- [AGOL Item](https://www.arcgis.com/home/item.html?id={{agolItemId}})`,
      labels: ['[ ]', 'verification', 'soft-delete-validation'],
    },
    {
      title: 'Verify Website Changes for {{layerName}}',
      body: `## Verify gis.utah.gov Updates

**Layer**: {{layerName}}

### Verification Checklist:
- [ ] Product page deleted or updated
- [ ] Removed from downloadMetadata
- [ ] Redirect added (if applicable)
- [ ] Website PR merged

### Test:
Visit the old product page URL and verify redirect or 404.`,
      labels: ['[ ]', 'verification', 'soft-delete-validation'],
    },
    {
      title: 'Verify SGID Index Updates for {{layerName}}',
      body: `## Verify SGID Index Changes

**Layer**: {{layerName}}
**Index ID**: {{sgidIndexId}}

### Verification Checklist:
- [ ] porterUrl points to this issue
- [ ] indexStatus is "removed"
- [ ] refreshCycle is "static"
- [ ] Record not visible in public SGID Index view

### Links:
- [SGID Index](https://docs.google.com/spreadsheets/d/{{sgidIndexId}})`,
      labels: ['[ ]', 'verification', 'soft-delete-validation'],
    },
    {
      title: 'Check for Community Complaints about {{layerName}}',
      body: `## Community Feedback Check

**Layer**: {{layerName}}
**Grace Period**: 14 days (completed)

### Tasks:
- [ ] Check this parent issue for comments/complaints
- [ ] Check email for feedback
- [ ] Check social media mentions
- [ ] Check support channels

### Complaint Detection:
React with 🚨 emoji on any comment that represents a complaint or concern.
If any 🚨 reactions are found, the workflow will pause for manual review.

### Assessment:
- **No complaints**: Proceed with hard delete
- **Minor complaints**: Document and address if possible
- **Major complaints**: May need to reconsider deprecation

Add summary of findings in comments below.`,
      labels: ['[ ]', 'verification', 'soft-delete-validation'],
    },
    {
      title: 'Verify Known Usages Migrated for {{layerName}}',
      body: `## Usage Migration Verification

**Layer**: {{layerName}}

### Verification Checklist:
- [ ] All identified usages have been updated
- [ ] Migrations have been tested
- [ ] No critical dependencies remain
- [ ] Documentation is updated

### Notes:
Review the "Check and Migrate Known Usages" task and verify all items are complete.`,
      labels: ['[ ]', 'verification', 'soft-delete-validation'],
    },
  ],
  transitions: [
    {
      event: TransitionEvent.TASK_COMPLETED,
      targetStage: 'hard-delete',
      actions: [
        {
          type: 'add_label',
          payload: { label: 'state: hard delete' },
        },
        {
          type: 'remove_label',
          payload: { label: 'state: soft delete validation' },
        },
        {
          type: 'post_comment',
          payload: {
            body: '## ✅ Soft Delete Validated\n\nAll soft delete changes have been verified and the grace period has passed. Proceeding to hard delete phase.\n\n**Warning**: Hard delete will permanently remove data. Review carefully before proceeding.',
          },
        },
      ],
    },
  ],
};

/**
 * Stage 4: Hard Delete
 * Actual removal from all systems
 */
const hardDeleteStage: Stage = {
  name: 'hard-delete',
  description: 'Permanently remove data from all systems',
  assigneeRole: AssigneeRole.TECHNICAL_LEAD,
  tasks: [
    {
      title: 'Delete ArcGIS Online Item for {{layerName}}',
      body: `## Delete AGOL Item

**Layer**: {{layerName}}
**AGOL Item**: {{agolItemId}}

### Tasks:
- [ ] Final confirmation: Ready to delete?
- [ ] Unshare from SGID group (if not done)
- [ ] Delete AGOL item permanently

### Links:
- [AGOL Item](https://www.arcgis.com/home/item.html?id={{agolItemId}})

**Warning**: This action cannot be undone!`,
      labels: ['[ ]', 'agol', 'hard-delete', 'destructive'],
    },
    {
      title: 'Archive AGOLItems Record for {{layerName}}',
      body: `## Archive AGOLItems Database Entry

**Layer**: {{layerName}}

### Tasks:
- [ ] Copy row from AGOLItems to AGOLItems_shelved table
- [ ] Verify copy completed successfully
- [ ] Remove row from AGOLItems table

**Note**: This preserves the record while removing it from active tracking.`,
      labels: ['[ ]', 'database', 'hard-delete'],
    },
    {
      title: 'Backup and Remove from Internal SGID for {{layerName}}',
      body: `## Internal SGID Removal

**Layer**: {{layerName}}
**Internal SGID**: {{internalSgidTable}}

### Tasks:
- [ ] Create backup of data to Google Drive
- [ ] Verify backup is complete
- [ ] Remove data from Internal SGID database
- [ ] Remove ChangeDetection row

### Backup Location:
Document the Drive location in comments.`,
      labels: ['[ ]', 'sgid', 'hard-delete', 'destructive'],
    },
    {
      title: 'Update SGID Index Flags for {{layerName}}',
      body: `## Update SGID Index Final Status

**Layer**: {{layerName}}
**Index ID**: {{sgidIndexId}}

### Tasks:
- [ ] Set arcGisOnline to False
- [ ] Set openSgid to False
- [ ] Verify flags are updated

### Links:
- [SGID Index](https://docs.google.com/spreadsheets/d/{{sgidIndexId}})`,
      labels: ['[ ]', 'sgid-index', 'hard-delete'],
    },
    {
      title: 'Remove Update Pipeline for {{layerName}}',
      body: `## Remove Automated Updates

**Layer**: {{layerName}}

### Tasks:
- [ ] Identify update pipeline/schedule
- [ ] Remove or disable automated updates
- [ ] Document removal

**Note**: This prevents future data updates from running.`,
      labels: ['[ ]', 'pipeline', 'hard-delete'],
    },
    {
      title: 'Remove from Forklift for {{layerName}}',
      body: `## Remove Forklift References

**Layer**: {{layerName}}

### Tasks:
- [ ] Remove from forklift hashing
- [ ] Remove from changedetection.gdb
- [ ] Remove from packing slip
- [ ] Commit changes to Forklift repository

**Note**: This is a manual process in the Forklift system.`,
      labels: ['[ ]', 'forklift', 'hard-delete'],
    },
    {
      title: 'Archive and Remove from Archives System for {{layerName}}',
      body: `## Archives Management

**Layer**: {{layerName}}
**Record Series**: {{archivesRecordSeries}}

### Tasks:
- [ ] Share export with Archives
- [ ] Get confirmation from Archives team
- [ ] Remove from active record series

**Note**: Ensure archives has the data before removing.`,
      labels: ['[ ]', 'archives', 'hard-delete'],
    },
    {
      title: 'Delete Google Drive Data for {{layerName}}',
      body: `## Remove Drive Backup

**Layer**: {{layerName}}

### Tasks:
- [ ] Confirm Archives has the data
- [ ] Locate Drive folder/files
- [ ] Delete from Google Drive
- [ ] Empty Drive trash

**Warning**: Only complete after Archives confirms receipt!`,
      labels: ['[ ]', 'drive', 'hard-delete', 'destructive'],
    },
  ],
  transitions: [
    {
      event: TransitionEvent.TASK_COMPLETED,
      targetStage: 'validate-hard-delete',
      actions: [
        {
          type: 'add_label',
          payload: { label: 'state: hard delete validation' },
        },
        {
          type: 'remove_label',
          payload: { label: 'state: hard delete' },
        },
        {
          type: 'post_comment',
          payload: {
            body: '## 🗑️ Hard Delete Complete\n\nAll hard delete tasks have been completed. Running final validation checks.',
          },
        },
      ],
    },
  ],
};

/**
 * Stage 5: Validate Hard Delete
 * Final verification that everything is removed
 */
const validateHardDeleteStage: Stage = {
  name: 'validate-hard-delete',
  description: 'Final verification that all data has been removed',
  assigneeRole: AssigneeRole.DATA_STEWARD,
  tasks: [
    {
      title: 'Verify SGID on ArcGIS Removal for {{layerName}}',
      body: `## Verify SGID Feature Service

**Layer**: {{layerName}}

### Verification Checklist:
- [ ] Item is not shared to any groups
- [ ] Item shows shelved/static status
- [ ] Item is not accessible via SGID service

### Test:
Try to access the layer via the SGID feature service and verify it's not available.`,
      labels: ['[ ]', 'verification', 'hard-delete-validation'],
    },
    {
      title: 'Verify Open SGID Removal for {{layerName}}',
      body: `## Verify Open SGID Database

**Layer**: {{layerName}}
**Open SGID Table**: {{openSgidTable}}

### Verification Checklist:
- [ ] Table is not visible in schema
- [ ] Table cannot be queried
- [ ] Connections return "not found"

### Test:
\`\`\`sql
SELECT * FROM {{openSgidTable}} LIMIT 1;
\`\`\`
Should return "relation does not exist" error.`,
      labels: ['[ ]', 'verification', 'hard-delete-validation'],
    },
    {
      title: 'Verify Internal SGID Removal for {{layerName}}',
      body: `## Verify Internal SGID Database

**Layer**: {{layerName}}
**Internal Table**: {{internalSgidTable}}

### Verification Checklist:
- [ ] Table is removed from database
- [ ] Backup exists in Drive
- [ ] ChangeDetection row removed

### Test:
Query the database to confirm table doesn't exist.`,
      labels: ['[ ]', 'verification', 'hard-delete-validation'],
    },
    {
      title: 'Final Checklist for {{layerName}} Deprecation',
      body: `## Final Deprecation Checklist

**Layer**: {{layerName}}

### Complete Verification:
- [ ] All AGOL references removed
- [ ] All SGID references removed
- [ ] All Open SGID references removed
- [ ] Archives has backup
- [ ] SGID Index updated
- [ ] Website updated
- [ ] No remaining dependencies
- [ ] All validation tasks complete

### Sign-off:
Once all items are verified, close this issue to complete the deprecation workflow.

**This will close the parent issue and mark the deprecation as complete.**`,
      labels: ['[ ]', 'verification', 'hard-delete-validation', 'final'],
    },
  ],
  transitions: [
    {
      event: TransitionEvent.TASK_COMPLETED,
      targetStage: '', // Empty means workflow complete
      actions: [
        {
          type: 'remove_label',
          payload: { label: 'state: hard delete validation' },
        },
        {
          type: 'add_label',
          payload: { label: 'status: completed' },
        },
        {
          type: 'post_comment',
          payload: {
            body: '## 🎉 Deprecation Complete!\n\n**{{layerName}}** has been successfully deprecated and removed from all systems.\n\n### Summary:\n- ✅ Soft delete completed\n- ✅ 14-day grace period observed\n- ✅ Soft delete validated\n- ✅ Hard delete completed\n- ✅ Final validation passed\n\nThis issue can now be closed.',
          },
        },
      ],
    },
  ],
};

/**
 * Complete SGID Deprecation Workflow Definition
 */
export const sgidDeprecationWorkflow: WorkflowDefinition = {
  type: WorkflowType.SGID_DEPRECATION,
  name: 'SGID Layer Deprecation',
  description:
    'Complete removal process for SGID layers including soft delete, grace period, and hard delete phases',
  stages: [
    firstIssueStage,
    softDeleteStage,
    validateSoftDeleteStage,
    hardDeleteStage,
    validateHardDeleteStage,
  ],
};
