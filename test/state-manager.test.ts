import { Octokit } from '@octokit/rest';
import test from 'ava';
import { GitHubService } from '../src/adapters/github-service.js';
import {
  StageStatus,
  TaskStatus,
  WorkflowStatus,
  WorkflowType,
} from '../src/models/types.js';
import type { WorkflowState } from '../src/models/workflow-state.js';
import { StateManager } from '../src/services/state-manager.js';

// Mock GitHub service for testing
class MockGitHubService extends GitHubService {
  private comments = new Map<number, string>();
  private nextCommentId = 1000;

  constructor() {
    super(new Octokit(), 'test-owner', 'test-repo');
  }

  override async findBotComment(
    _issueNumber: number,
    marker: string,
  ): Promise<number | null> {
    for (const [id, body] of this.comments.entries()) {
      if (body.includes(marker)) {
        return id;
      }
    }
    return null;
  }

  override async getComment(commentId: number): Promise<string> {
    return this.comments.get(commentId) || '';
  }

  override async createComment(
    _issueNumber: number,
    body: string,
  ): Promise<number> {
    const id = this.nextCommentId++;
    this.comments.set(id, body);
    return id;
  }

  override async updateComment(commentId: number, body: string): Promise<void> {
    this.comments.set(commentId, body);
  }

  // Helper for tests
  clear() {
    this.comments.clear();
  }
}

// Test fixtures
const createTestState = (): WorkflowState => ({
  version: '1.0.0',
  workflowType: WorkflowType.SGID_DEPRECATION,
  issueNumber: 123,
  status: WorkflowStatus.ACTIVE,
  currentStage: 'deprecation-review',
  data: { 'display-name': 'Utah Test Data' },
  stages: {
    'deprecation-review': {
      name: 'deprecation-review',
      status: StageStatus.IN_PROGRESS,
      taskIssues: [],
      startedAt: '2025-12-31T00:00:00Z',
    },
    'impact-assessment': {
      name: 'impact-assessment',
      status: StageStatus.PENDING,
      taskIssues: [],
    },
  },
  createdAt: '2025-12-31T00:00:00Z',
  updatedAt: '2025-12-31T00:00:00Z',
});

// Tests
test('StateManager is instantiable', (t) => {
  const github = new MockGitHubService();
  const stateManager = new StateManager(github);
  t.truthy(stateManager);
});

test('StateManager.loadState returns null when no state exists', async (t) => {
  const github = new MockGitHubService();
  const stateManager = new StateManager(github);

  const state = await stateManager.loadState(123);
  t.is(state, null);
});

test('StateManager.saveState creates new comment', async (t) => {
  const github = new MockGitHubService();
  const stateManager = new StateManager(github);
  const testState = createTestState();

  await stateManager.saveState(testState);

  // Verify comment was created
  const commentId = await github.findBotComment(123, '<!-- issue-ops-state');
  t.truthy(commentId);
  t.not(commentId, null);

  const commentBody = await github.getComment(commentId!);
  t.true(commentBody.includes('<!-- issue-ops-state'));
  t.true(commentBody.includes('## 🚂 Workflow Progress'));
});

test('StateManager.saveState updates existing comment', async (t) => {
  const github = new MockGitHubService();
  const stateManager = new StateManager(github);
  const testState = createTestState();

  // Save once
  await stateManager.saveState(testState);
  const firstCommentId = await github.findBotComment(
    123,
    '<!-- issue-ops-state',
  );

  // Update state and save again
  testState.status = WorkflowStatus.COMPLETED;
  await stateManager.saveState(testState);

  const secondCommentId = await github.findBotComment(
    123,
    '<!-- issue-ops-state',
  );

  // Should be same comment, not a new one
  t.is(firstCommentId, secondCommentId);

  const commentBody = await github.getComment(secondCommentId!);
  t.true(commentBody.includes('completed'));
});

test('StateManager.loadState parses state correctly', async (t) => {
  const github = new MockGitHubService();
  const stateManager = new StateManager(github);
  const testState = createTestState();

  // Save state
  await stateManager.saveState(testState);

  // Load state back
  const loadedState = await stateManager.loadState(123);

  t.truthy(loadedState);
  t.is(loadedState!.workflowType, WorkflowType.SGID_DEPRECATION);
  t.is(loadedState!.issueNumber, 123);
  t.is(loadedState!.status, WorkflowStatus.ACTIVE);
  t.is(loadedState!.currentStage, 'deprecation-review');
  t.deepEqual(loadedState!.data, { 'display-name': 'Utah Test Data' });
});

test('StateManager.saveState updates timestamp', async (t) => {
  const github = new MockGitHubService();
  const stateManager = new StateManager(github);
  const testState = createTestState();

  const originalUpdatedAt = testState.updatedAt;

  // Wait a bit to ensure timestamp changes
  await new Promise((resolve) => setTimeout(resolve, 10));

  await stateManager.saveState(testState);

  t.not(testState.updatedAt, originalUpdatedAt);
});

test('StateManager renders state with task issues', async (t) => {
  const github = new MockGitHubService();
  const stateManager = new StateManager(github);
  const testState = createTestState();

  // Add task issues to the state
  testState.stages['deprecation-review']!.taskIssues = [
    {
      number: 124,
      title: 'Review deprecation request',
      status: TaskStatus.IN_PROGRESS,
      parentIssue: 123,
      stage: 'deprecation-review',
      createdAt: '2025-12-31T00:00:00Z',
      url: 'https://github.com/test/test/issues/124',
    },
    {
      number: 125,
      title: 'Update documentation',
      status: TaskStatus.OPEN,
      parentIssue: 123,
      stage: 'deprecation-review',
      createdAt: '2025-12-31T00:00:00Z',
      url: 'https://github.com/test/test/issues/125',
    },
  ];

  await stateManager.saveState(testState);

  const commentId = await github.findBotComment(123, '<!-- issue-ops-state');
  const commentBody = await github.getComment(commentId!);

  t.true(commentBody.includes('Task #124'));
  t.true(commentBody.includes('Task #125'));
});

test('StateManager renders grace period info', async (t) => {
  const github = new MockGitHubService();
  const stateManager = new StateManager(github);
  const testState = createTestState();

  // Add grace period
  if (testState.stages['deprecation-review']) {
    testState.stages['deprecation-review'].gracePeriodEndsAt =
      '2026-01-30T00:00:00Z';
  }

  await stateManager.saveState(testState);

  const commentId = await github.findBotComment(123, '<!-- issue-ops-state');
  t.not(commentId, null);
  const commentBody = await github.getComment(commentId!);

  t.true(commentBody.includes('⏰ **Grace Period**'));
});

test('StateManager renders feature flags', async (t) => {
  const github = new MockGitHubService();
  const stateManager = new StateManager(github);
  const testState = createTestState();

  testState.featureFlags = {
    skipValidation: true,
    verboseLogging: true,
  };

  await stateManager.saveState(testState);

  const commentId = await github.findBotComment(123, '<!-- issue-ops-state');
  const commentBody = await github.getComment(commentId!);

  t.true(commentBody.includes('🚩 **Feature Flags**'));
  t.true(commentBody.includes('skipValidation'));
});

test('StateManager validates state on save', async (t) => {
  const github = new MockGitHubService();
  const stateManager = new StateManager(github);
  const testState = createTestState();

  // Remove required field
  delete (testState as any).version;

  await t.throwsAsync(
    () => stateManager.saveState(testState as WorkflowState),
    { message: /version is required/ },
  );
});

test('StateManager throws on invalid JSON in comment', async (t) => {
  const github = new MockGitHubService();
  const stateManager = new StateManager(github);

  // Manually create comment with invalid JSON
  await github.createComment(123, '<!-- issue-ops-state\n{invalid json}\n-->');

  await t.throwsAsync(() => stateManager.loadState(123), {
    message: /Failed to parse state JSON/,
  });
});

test('StateManager includes stage emojis based on status', async (t) => {
  const github = new MockGitHubService();
  const stateManager = new StateManager(github);
  const testState = createTestState();

  if (testState.stages['deprecation-review']) {
    testState.stages['deprecation-review'].status = StageStatus.COMPLETED;
  }
  if (testState.stages['impact-assessment']) {
    testState.stages['impact-assessment'].status = StageStatus.IN_PROGRESS;
  }
  testState.currentStage = 'impact-assessment';

  await stateManager.saveState(testState);

  const commentId = await github.findBotComment(123, '<!-- issue-ops-state');
  t.not(commentId, null);
  const commentBody = await github.getComment(commentId!);

  t.true(commentBody.includes('✅ **deprecation-review**')); // completed
  t.true(commentBody.includes('▶️ **impact-assessment**')); // current
});
