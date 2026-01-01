import test from 'ava';
import {
  AssigneeRole,
  StageStatus,
  TransitionEvent,
  WorkflowStatus,
  WorkflowType,
} from '../src/models/types.js';
import type { WorkflowState } from '../src/models/workflow-state.js';
import type { WorkflowDefinition } from '../src/models/workflow-definition.js';

test('enum types are defined', (t) => {
  // Just verify enums exist and have expected members
  t.truthy(WorkflowType.SGID_DEPRECATION);
  t.truthy(WorkflowStatus.ACTIVE);
  t.truthy(StageStatus.IN_PROGRESS);
  t.truthy(TransitionEvent.TASK_COMPLETED);
  t.truthy(AssigneeRole.DATA_STEWARD);
});

test('can create valid WorkflowState object', (t) => {
  const state: WorkflowState = {
    version: '1.0.0',
    workflowType: WorkflowType.SGID_DEPRECATION,
    issueNumber: 123,
    status: WorkflowStatus.ACTIVE,
    currentStage: 'deprecation-review',
    data: {
      'display-name': 'Utah Roads',
      'internal-sgid-table': 'transportation.roads',
    },
    stages: {
      'deprecation-review': {
        name: 'deprecation-review',
        status: StageStatus.IN_PROGRESS,
        taskIssues: [124, 125],
        startedAt: '2025-12-31T00:00:00Z',
      },
    },
    createdAt: '2025-12-31T00:00:00Z',
    updatedAt: '2025-12-31T00:00:00Z',
  };

  t.is(state.issueNumber, 123);
  t.is(state.workflowType, WorkflowType.SGID_DEPRECATION);
  t.is(state.status, WorkflowStatus.ACTIVE);
  t.is(state.stages['deprecation-review']?.status, StageStatus.IN_PROGRESS);
  t.deepEqual(state.stages['deprecation-review']?.taskIssues, [124, 125]);
});

test('WorkflowState can include feature flags', (t) => {
  const state: WorkflowState = {
    version: '1.0.0',
    workflowType: WorkflowType.SGID_DEPRECATION,
    issueNumber: 123,
    status: WorkflowStatus.ACTIVE,
    currentStage: 'deprecation-review',
    data: {},
    stages: {},
    featureFlags: {
      skipValidation: true,
      verboseLogging: true,
    },
    createdAt: '2025-12-31T00:00:00Z',
    updatedAt: '2025-12-31T00:00:00Z',
  };

  t.is(state.featureFlags?.skipValidation, true);
  t.is(state.featureFlags?.verboseLogging, true);
  t.is(state.featureFlags?.skipSecurityReview, undefined);
});

test('can create valid WorkflowDefinition object', (t) => {
  const workflow: WorkflowDefinition = {
    type: WorkflowType.SGID_DEPRECATION,
    name: 'SGID Deprecation',
    description: 'Workflow for deprecating SGID layers',
    stages: [
      {
        name: 'initial-review',
        description: 'Review deprecation request',
        assigneeRole: AssigneeRole.DATA_STEWARD,
        tasks: [
          {
            title: 'Review deprecation request',
            body: 'Review the request for {{display-name}}',
            labels: ['task: review'],
          },
        ],
        transitions: [
          {
            event: TransitionEvent.TASK_COMPLETED,
            targetStage: 'impact-assessment',
          },
        ],
      },
    ],
  };

  t.is(workflow.type, WorkflowType.SGID_DEPRECATION);
  t.is(workflow.stages.length, 1);
  t.is(workflow.stages[0]?.name, 'initial-review');
  t.is(workflow.stages[0]?.assigneeRole, AssigneeRole.DATA_STEWARD);
  t.is(workflow.stages[0]?.tasks.length, 1);
  t.is(workflow.stages[0]?.transitions.length, 1);
});


