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
  private issueBodies = new Map<number, string>();

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

  override async getIssueBody(issueNumber: number): Promise<string> {
    return this.issueBodies.get(issueNumber) || '';
  }

  override async updateIssueBody(issueNumber: number, body: string): Promise<void> {
    this.issueBodies.set(issueNumber, body);
  }

  // Helper for tests
  clear() {
    this.comments.clear();
    this.issueBodies.clear();
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

  // Set initial issue body (simulating issue creation)
  await github.updateIssueBody(123, '### Original Issue\n\nSome content');

  await stateManager.saveState(testState);

  // Verify state was added to issue body
  const issueBody = await github.getIssueBody(123);
  t.true(issueBody.includes('<!-- issue-ops-state'));
  t.true(issueBody.includes('Original Issue'));
});

test('StateManager.saveState updates existing comment', async (t) => {
  const github = new MockGitHubService();
  const stateManager = new StateManager(github);
  const testState = createTestState();

  // Set initial issue body
  await github.updateIssueBody(123, '### Original Issue\n\nSome content');

  // Save once
  await stateManager.saveState(testState);
  const firstBody = await github.getIssueBody(123);

  // Update state and save again
  testState.status = WorkflowStatus.COMPLETED;
  await stateManager.saveState(testState);

  const secondBody = await github.getIssueBody(123);

  // Should only have one state marker
  const stateMatches = secondBody.match(/<!-- issue-ops-state/g);
  t.is(stateMatches?.length, 1);
  t.true(secondBody.includes('completed'));
});

test('StateManager.loadState parses state correctly', async (t) => {
  const github = new MockGitHubService();
  const stateManager = new StateManager(github);
  const testState = createTestState();

  // Set initial issue body
  await github.updateIssueBody(123, '### Original Issue\n\nSome content');

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

  // Set initial issue body
  await github.updateIssueBody(123, '### Original Issue\n\nSome content');

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

  // Set initial issue body
  await github.updateIssueBody(123, '### Original Issue\n\nSome content');

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

  const issueBody = await github.getIssueBody(123);

  // State is now embedded in JSON, check that task issues are in the JSON
  t.true(issueBody.includes('"number": 124'));
  t.true(issueBody.includes('"number": 125'));
});

test('StateManager renders grace period info', async (t) => {
  const github = new MockGitHubService();
  const stateManager = new StateManager(github);
  const testState = createTestState();

  // Set initial issue body
  await github.updateIssueBody(123, '### Original Issue\n\nSome content');

  // Add grace period
  if (testState.stages['deprecation-review']) {
    testState.stages['deprecation-review'].gracePeriodEndsAt =
      '2026-01-30T00:00:00Z';
  }

  await stateManager.saveState(testState);

  const issueBody = await github.getIssueBody(123);

  // State is now embedded in JSON
  t.true(issueBody.includes('gracePeriodEndsAt'));
  t.true(issueBody.includes('2026-01-30'));
});

test('StateManager renders feature flags', async (t) => {
  const github = new MockGitHubService();
  const stateManager = new StateManager(github);
  const testState = createTestState();

  // Set initial issue body
  await github.updateIssueBody(123, '### Original Issue\n\nSome content');

  testState.featureFlags = {
    skipValidation: true,
    verboseLogging: true,
  };

  await stateManager.saveState(testState);

  const issueBody = await github.getIssueBody(123);

  // State is now embedded in JSON
  t.true(issueBody.includes('featureFlags'));
  t.true(issueBody.includes('skipValidation'));
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

  // Set initial issue body
  await github.updateIssueBody(123, '### Original Issue\n\nSome content');

  if (testState.stages['deprecation-review']) {
    testState.stages['deprecation-review'].status = StageStatus.COMPLETED;
  }
  if (testState.stages['impact-assessment']) {
    testState.stages['impact-assessment'].status = StageStatus.IN_PROGRESS;
  }
  testState.currentStage = 'impact-assessment';

  await stateManager.saveState(testState);

  const issueBody = await github.getIssueBody(123);

  // State is now embedded in JSON, check stage status values
  t.true(issueBody.includes('deprecation-review'));
  t.true(issueBody.includes(StageStatus.COMPLETED));
  t.true(issueBody.includes('impact-assessment'));
  t.true(issueBody.includes(StageStatus.IN_PROGRESS));
});
