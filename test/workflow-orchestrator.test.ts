import test from 'ava';
import { WorkflowOrchestrator } from '../src/services/workflow-orchestrator.js';
import { StateManager } from '../src/services/state-manager.js';
import { GitHubService } from '../src/adapters/github-service.js';
import { Octokit } from '@octokit/rest';
import {
  WorkflowType,
  WorkflowStatus,
  StageStatus,
  TransitionEvent,
} from '../src/models/types.js';
import type { WorkflowDefinition } from '../src/models/workflow-definition.js';
import type { WorkflowState } from '../src/models/workflow-state.js';

// Mock GitHub service
class MockGitHubService extends GitHubService {
  private comments: Array<{ issueNumber: number; body: string }> = [];
  private labels: Map<number, Set<string>> = new Map();

  constructor() {
    super(new Octokit(), 'test-owner', 'test-repo');
  }

  override async createComment(issueNumber: number, body: string): Promise<number> {
    this.comments.push({ issueNumber, body });
    return this.comments.length;
  }

  override async addLabels(issueNumber: number, labels: string[]): Promise<void> {
    if (!this.labels.has(issueNumber)) {
      this.labels.set(issueNumber, new Set());
    }
    labels.forEach((label) => this.labels.get(issueNumber)!.add(label));
  }

  override async removeLabel(issueNumber: number, label: string): Promise<void> {
    this.labels.get(issueNumber)?.delete(label);
  }

  override async getLabels(issueNumber: number): Promise<string[]> {
    return Array.from(this.labels.get(issueNumber) || []);
  }

  // Test helpers
  getComments(issueNumber: number): string[] {
    return this.comments
      .filter((c) => c.issueNumber === issueNumber)
      .map((c) => c.body);
  }

  getLabelsSync(issueNumber: number): string[] {
    return Array.from(this.labels.get(issueNumber) || []);
  }

  clear() {
    this.comments = [];
    this.labels.clear();
  }
}

// Mock state manager
class MockStateManager extends StateManager {
  private states = new Map<number, WorkflowState>();

  constructor(github: GitHubService) {
    super(github);
  }

  override async loadState(issueNumber: number): Promise<WorkflowState | null> {
    return this.states.get(issueNumber) || null;
  }

  override async saveState(state: WorkflowState): Promise<void> {
    this.states.set(state.issueNumber, state);
  }

  // Test helper
  clear() {
    this.states.clear();
  }
}

// Test workflow definition
const testWorkflowDef: WorkflowDefinition = {
  type: WorkflowType.SGID_DEPRECATION,
  name: 'SGID Deprecation',
  description: 'Deprecation workflow for SGID layers',
  stages: [
    {
      name: 'review',
      description: 'Initial review',
      assigneeRole: 'reviewer',
      tasks: [],
      transitions: [
        {
          event: TransitionEvent.TASK_COMPLETED,
          targetStage: 'approval',
        },
      ],
    },
    {
      name: 'approval',
      description: 'Final approval',
      assigneeRole: 'approver',
      tasks: [],
      transitions: [
        {
          event: TransitionEvent.TASK_COMPLETED,
          targetStage: '', // Empty means workflow complete
        },
      ],
    },
  ],
};

// Tests
test.beforeEach((t) => {
  const github = new MockGitHubService();
  const stateManager = new MockStateManager(github);
  const orchestrator = new WorkflowOrchestrator(stateManager, github);

  t.context = { github, stateManager, orchestrator };
});

test('WorkflowOrchestrator is instantiable', (t) => {
  const { orchestrator } = t.context as any;
  t.truthy(orchestrator);
});

test('initializeWorkflow creates initial state', async (t) => {
  const { orchestrator, stateManager } = t.context as any;

  const state = await orchestrator.initializeWorkflow(
    123,
    testWorkflowDef,
    { 'display-name': 'Test Layer' },
  );

  t.is(state.workflowType, WorkflowType.SGID_DEPRECATION);
  t.is(state.issueNumber, 123);
  t.is(state.status, WorkflowStatus.ACTIVE);
  t.is(state.currentStage, 'review');

  // First stage should be in progress
  t.is(state.stages['review'].status, StageStatus.IN_PROGRESS);
  t.truthy(state.stages['review'].startedAt);

  // Other stages should be pending
  t.is(state.stages['approval'].status, StageStatus.PENDING);

  // State should be saved
  const loadedState = await stateManager.loadState(123);
  t.truthy(loadedState);
  t.is(loadedState!.currentStage, 'review');
});

test('initializeWorkflow posts initialization comment', async (t) => {
  const { orchestrator, github } = t.context as any;

  await orchestrator.initializeWorkflow(123, testWorkflowDef, {});

  const comments = github.getComments(123);
  t.is(comments.length, 1);
  t.true(comments[0].includes('SGID Deprecation Workflow Started'));
  t.true(comments[0].includes('review'));
  t.true(comments[0].includes('approval'));
});

test('transitionStage moves to next stage', async (t) => {
  const { orchestrator, stateManager } = t.context as any;

  // Initialize workflow
  await orchestrator.initializeWorkflow(123, testWorkflowDef, {});

  // Transition to next stage
  const updatedState = await orchestrator.transitionStage(
    123,
    TransitionEvent.TASK_COMPLETED,
    testWorkflowDef,
  );

  t.truthy(updatedState);
  t.is(updatedState!.currentStage, 'approval');
  t.is(updatedState!.status, WorkflowStatus.ACTIVE);

  // Previous stage should be completed
  t.is(updatedState!.stages['review'].status, StageStatus.COMPLETED);
  t.truthy(updatedState!.stages['review'].completedAt);

  // New stage should be in progress
  t.is(updatedState!.stages['approval'].status, StageStatus.IN_PROGRESS);
  t.truthy(updatedState!.stages['approval'].startedAt);
});

test('transitionStage posts stage transition comment', async (t) => {
  const { orchestrator, github } = t.context as any;

  await orchestrator.initializeWorkflow(123, testWorkflowDef, {});
  github.clear(); // Clear init comment

  await orchestrator.transitionStage(
    123,
    TransitionEvent.TASK_COMPLETED,
    testWorkflowDef,
  );

  const comments = github.getComments(123);
  t.is(comments.length, 1);
  t.true(comments[0].includes('Stage: approval'));
});

test('transitionStage completes workflow when no target stage', async (t) => {
  const { orchestrator, github } = t.context as any;

  await orchestrator.initializeWorkflow(123, testWorkflowDef, {});
  
  // Move to approval stage
  await orchestrator.transitionStage(
    123,
    TransitionEvent.TASK_COMPLETED,
    testWorkflowDef,
  );

  github.clear();

  // Complete final stage
  const finalState = await orchestrator.transitionStage(
    123,
    TransitionEvent.TASK_COMPLETED,
    testWorkflowDef,
  );

  t.truthy(finalState);
  t.is(finalState!.status, WorkflowStatus.COMPLETED);

  const comments = github.getComments(123);
  t.true(comments[0].includes('Workflow Complete'));
});

test('transitionStage returns null for unknown event', async (t) => {
  const { orchestrator } = t.context as any;

  await orchestrator.initializeWorkflow(123, testWorkflowDef, {});

  const result = await orchestrator.transitionStage(
    123,
    TransitionEvent.GRACE_PERIOD_EXPIRED,
    testWorkflowDef,
  );

  t.is(result, null);
});

test('transitionStage handles grace period stages', async (t) => {
  const { orchestrator, stateManager, github } = t.context as any;

  const gracePeriodWorkflow: WorkflowDefinition = {
    ...testWorkflowDef,
    stages: [
      {
        name: 'review',
        description: 'Review',
        assigneeRole: 'reviewer',
        tasks: [],
        transitions: [
          {
            event: TransitionEvent.TASK_COMPLETED,
            targetStage: 'grace-period',
          },
        ],
      },
      {
        name: 'grace-period',
        description: 'Grace period',
        assigneeRole: 'none',
        gracePeriodDays: 30,
        tasks: [],
        transitions: [
          {
            event: TransitionEvent.GRACE_PERIOD_EXPIRED,
            targetStage: 'removal',
          },
        ],
      },
      {
        name: 'removal',
        description: 'Remove layer',
        assigneeRole: 'admin',
        tasks: [],
        transitions: [],
      },
    ],
  };

  await orchestrator.initializeWorkflow(123, gracePeriodWorkflow, {});

  const state = await orchestrator.transitionStage(
    123,
    TransitionEvent.TASK_COMPLETED,
    gracePeriodWorkflow,
  );

  t.truthy(state);
  t.is(state!.currentStage, 'grace-period');
  t.is(state!.status, WorkflowStatus.PAUSED);
  t.truthy(state!.stages['grace-period'].gracePeriodEndsAt);

  // Should add grace period label
  const labels = github.getLabelsSync(123);
  t.true(labels.includes('paused: grace-period'));
});

test('canTransition checks if transition is possible', (t) => {
  const { orchestrator } = t.context as any;

  const state: WorkflowState = {
    version: '1.0.0',
    workflowType: WorkflowType.SGID_DEPRECATION,
    issueNumber: 123,
    status: WorkflowStatus.ACTIVE,
    currentStage: 'review',
    data: {},
    stages: {
      review: {
        name: 'review',
        status: StageStatus.IN_PROGRESS,
        taskIssues: [],
      },
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  // Valid transition
  t.true(
    orchestrator.canTransition(state, TransitionEvent.TASK_COMPLETED, testWorkflowDef),
  );

  // Invalid transition
  t.false(
    orchestrator.canTransition(state, TransitionEvent.GRACE_PERIOD_EXPIRED, testWorkflowDef),
  );
});

test('skipStage skips current stage if allowed', async (t) => {
  const { orchestrator, stateManager, github } = t.context as any;

  const skipWorkflow: WorkflowDefinition = {
    ...testWorkflowDef,
    stages: [
      {
        name: testWorkflowDef.stages[0]!.name,
        description: testWorkflowDef.stages[0]!.description,
        assigneeRole: testWorkflowDef.stages[0]!.assigneeRole,
        tasks: testWorkflowDef.stages[0]!.tasks,
        allowManualSkip: true,
        transitions: [
          {
            event: TransitionEvent.TASK_COMPLETED,
            targetStage: 'approval',
          },
          {
            event: TransitionEvent.MANUAL_SKIP,
            targetStage: 'approval',
          },
        ],
      },
      testWorkflowDef.stages[1]!,
    ],
  };

  await orchestrator.initializeWorkflow(123, skipWorkflow, {});

  const result = await orchestrator.skipStage(123, skipWorkflow, 'Not needed');

  t.truthy(result);
  t.is(result!.currentStage, 'approval');
  t.is(result!.stages['review'].status, StageStatus.SKIPPED);
  t.true(result!.stages['review'].notes!.includes('Not needed'));

  const comments = github.getComments(123);
  const skipComment = comments.find((c: string) => c.includes('Stage Skipped'));
  t.truthy(skipComment);
});

test('skipStage returns null if stage cannot be skipped', async (t) => {
  const { orchestrator } = t.context as any;

  await orchestrator.initializeWorkflow(123, testWorkflowDef, {});

  const result = await orchestrator.skipStage(123, testWorkflowDef, 'Trying to skip');

  t.is(result, null);
});

test('transitionStage executes transition actions', async (t) => {
  const { orchestrator, github } = t.context as any;

  const actionWorkflow: WorkflowDefinition = {
    ...testWorkflowDef,
    stages: [
      {
        name: testWorkflowDef.stages[0]!.name,
        description: testWorkflowDef.stages[0]!.description,
        assigneeRole: testWorkflowDef.stages[0]!.assigneeRole,
        tasks: testWorkflowDef.stages[0]!.tasks,
        transitions: [
          {
            event: TransitionEvent.TASK_COMPLETED,
            targetStage: 'approval',
            actions: [
              {
                type: 'add_label',
                payload: { label: 'approved' },
              },
              {
                type: 'post_comment',
                payload: { body: 'Approved!' },
              },
            ],
          },
        ],
      },
      testWorkflowDef.stages[1]!,
    ],
  };

  await orchestrator.initializeWorkflow(123, actionWorkflow, {});
  github.clear();

  await orchestrator.transitionStage(
    123,
    TransitionEvent.TASK_COMPLETED,
    actionWorkflow,
  );

  // Check label was added
  const labels = github.getLabelsSync(123);
  t.true(labels.includes('approved'));

  // Check comment was posted
  const comments = github.getComments(123);
  t.true(comments.some((c: string) => c.includes('Approved!')));
});
