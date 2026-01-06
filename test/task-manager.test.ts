import { Octokit } from '@octokit/rest';
import test from 'ava';
import type { CreateIssueParams } from '../src/adapters/github-service.js';
import { GitHubService } from '../src/adapters/github-service.js';
import {
  StageStatus,
  TaskStatus,
  WorkflowStatus,
  WorkflowType,
} from '../src/models/types.js';
import type { TaskTemplate } from '../src/models/workflow-definition.js';
import type { WorkflowState } from '../src/models/workflow-state.js';
import { StateManager } from '../src/services/state-manager.js';
import { TaskManager } from '../src/services/task-manager.js';

// Mock GitHub service
class MockGitHubService extends GitHubService {
  private issues = new Map<
    number,
    { title: string; body: string; labels: string[]; assignee?: string }
  >();
  private comments: Array<{ issueNumber: number; body: string }> = [];
  private issueCounter = 1000;

  constructor() {
    super(new Octokit(), 'test-owner', 'test-repo');
  }

  override async createIssue(params: CreateIssueParams): Promise<number> {
    const { title, body, labels = [], assignees = [] } = params;
    const issueNumber = this.issueCounter++;
    this.issues.set(issueNumber, {
      title,
      body,
      labels,
      assignee: assignees[0],
    });
    return issueNumber;
  }

  override async createComment(
    issueNumber: number,
    body: string,
  ): Promise<number> {
    this.comments.push({ issueNumber, body });
    return this.comments.length;
  }

  // Test helpers
  getIssue(issueNumber: number) {
    return this.issues.get(issueNumber);
  }

  getComments(issueNumber: number): string[] {
    return this.comments
      .filter((c) => c.issueNumber === issueNumber)
      .map((c) => c.body);
  }

  clear() {
    this.issues.clear();
    this.comments = [];
    this.issueCounter = 1000;
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
  setState(state: WorkflowState) {
    this.states.set(state.issueNumber, state);
  }

  clear() {
    this.states.clear();
  }
}

// Test fixtures
const createTestState = (issueNumber: number): WorkflowState => ({
  version: '1.0.0',
  workflowType: WorkflowType.SGID_DEPRECATION,
  issueNumber,
  status: WorkflowStatus.ACTIVE,
  currentStage: 'review',
  data: { 'display-name': 'Test Layer' },
  stages: {
    review: {
      name: 'review',
      status: StageStatus.IN_PROGRESS,
      taskIssues: [],
    },
    approval: {
      name: 'approval',
      status: StageStatus.PENDING,
      taskIssues: [],
    },
  },
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
});

const testTaskTemplates: TaskTemplate[] = [
  {
    title: 'Review data quality for {{layerName}}',
    body: 'Please review the data quality metrics.\n\nLayer: {{layerName}}',
    labels: ['task', 'review'],
    assignee: 'reviewer1',
  },
  {
    title: 'Update documentation',
    body: 'Update the documentation for {{layerName}}',
    labels: ['task', 'docs'],
  },
];

// Tests
test.beforeEach((t) => {
  const github = new MockGitHubService();
  const stateManager = new MockStateManager(github);
  const taskManager = new TaskManager(github, stateManager);

  t.context = { github, stateManager, taskManager };
});

test('TaskManager is instantiable', (t) => {
  const { taskManager } = t.context as any;
  t.truthy(taskManager);
});

test('createTaskIssues creates issues from templates', async (t) => {
  const { taskManager, stateManager, github } = t.context as any;

  const state = createTestState(123);
  stateManager.setState(state);

  const tasks = await taskManager.createTaskIssues(
    123,
    'review',
    testTaskTemplates,
    'default-assignee',
    { layerName: 'TestLayer' },
  );

  t.is(tasks.length, 2);

  // Check first task
  t.is(tasks[0].title, 'Review data quality for TestLayer');
  t.is(tasks[0].assignee, 'reviewer1'); // Template overrides default
  t.is(tasks[0].status, TaskStatus.OPEN);
  t.is(tasks[0].parentIssue, 123);
  t.is(tasks[0].stage, 'review');

  // Check second task
  t.is(tasks[1].title, 'Update documentation');
  t.is(tasks[1].assignee, 'default-assignee'); // Uses default

  // Verify issues were created
  const issue1 = github.getIssue(tasks[0].number);
  t.truthy(issue1);
  t.is(issue1!.title, 'Review data quality for TestLayer');
  t.true(issue1!.body.includes('**Parent Issue**: #123'));
  t.true(issue1!.body.includes('**Stage**: review'));
  t.deepEqual(issue1!.labels, ['task', 'review']);
});

test('createTaskIssues interpolates variables', async (t) => {
  const { taskManager, stateManager, github } = t.context as any;

  const state = createTestState(123);
  stateManager.setState(state);

  const template: TaskTemplate[] = [
    {
      title: 'Process {{action}} for {{name}}',
      body: 'Details: {{description}}\n\nStatus: {{status}}',
      labels: ['task'],
    },
  ];

  const tasks = await taskManager.createTaskIssues(
    123,
    'review',
    template,
    undefined,
    {
      action: 'deprecation',
      name: 'MyLayer',
      description: 'Remove old layer',
      status: 'pending',
    },
  );

  t.is(tasks[0].title, 'Process deprecation for MyLayer');

  const issue = github.getIssue(tasks[0].number);
  t.true(issue!.body.includes('Details: Remove old layer'));
  t.true(issue!.body.includes('Status: pending'));
});

test('createTaskIssues adds tasks to state', async (t) => {
  const { taskManager, stateManager } = t.context as any;

  const state = createTestState(123);
  stateManager.setState(state);

  await taskManager.createTaskIssues(123, 'review', testTaskTemplates);

  const updatedState = await stateManager.loadState(123);
  t.truthy(updatedState);
  t.is(updatedState!.stages['review'].taskIssues?.length, 2);
  t.is(updatedState!.stages['review'].taskIssues![0].status, TaskStatus.OPEN);
});

test('createTaskIssues posts summary comment', async (t) => {
  const { taskManager, stateManager, github } = t.context as any;

  const state = createTestState(123);
  stateManager.setState(state);

  await taskManager.createTaskIssues(
    123,
    'review',
    testTaskTemplates,
    'test-user',
  );

  const comments = github.getComments(123);
  t.is(comments.length, 1);
  t.true(comments[0].includes('Tasks Created for Stage: review'));
  t.true(comments[0].includes('**Progress**: 0/2 completed'));
});

test('areAllTasksCompleted returns true when all tasks done', async (t) => {
  const { taskManager, stateManager } = t.context as any;

  const state = createTestState(123);
  state.stages['review']!.taskIssues = [
    {
      number: 1001,
      title: 'Task 1',
      status: TaskStatus.COMPLETED,
      parentIssue: 123,
      stage: 'review',
      createdAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
      url: 'https://github.com/test/test/issues/1001',
    },
    {
      number: 1002,
      title: 'Task 2',
      status: TaskStatus.COMPLETED,
      parentIssue: 123,
      stage: 'review',
      createdAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
      url: 'https://github.com/test/test/issues/1002',
    },
  ];
  stateManager.setState(state);

  const allCompleted = await taskManager.areAllTasksCompleted(123, 'review');
  t.true(allCompleted);
});

test('areAllTasksCompleted returns false when tasks pending', async (t) => {
  const { taskManager, stateManager } = t.context as any;

  const state = createTestState(123);
  state.stages['review']!.taskIssues = [
    {
      number: 1001,
      title: 'Task 1',
      status: TaskStatus.COMPLETED,
      parentIssue: 123,
      stage: 'review',
      createdAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
      url: 'https://github.com/test/test/issues/1001',
    },
    {
      number: 1002,
      title: 'Task 2',
      status: TaskStatus.OPEN,
      parentIssue: 123,
      stage: 'review',
      createdAt: new Date().toISOString(),
      url: 'https://github.com/test/test/issues/1002',
    },
  ];
  stateManager.setState(state);

  const allCompleted = await taskManager.areAllTasksCompleted(123, 'review');
  t.false(allCompleted);
});

test('areAllTasksCompleted returns true for stage with no tasks', async (t) => {
  const { taskManager, stateManager } = t.context as any;

  const state = createTestState(123);
  stateManager.setState(state);

  const allCompleted = await taskManager.areAllTasksCompleted(123, 'review');
  t.true(allCompleted);
});

test('updateTaskStatus updates task in state', async (t) => {
  const { taskManager, stateManager } = t.context as any;

  const state = createTestState(123);
  state.stages['review']!.taskIssues = [
    {
      number: 1001,
      title: 'Task 1',
      status: TaskStatus.OPEN,
      parentIssue: 123,
      stage: 'review',
      createdAt: new Date().toISOString(),
      url: 'https://github.com/test/test/issues/1001',
    },
  ];
  stateManager.setState(state);

  await taskManager.updateTaskStatus(123, 1001, TaskStatus.COMPLETED);

  const updatedState = await stateManager.loadState(123);
  const task = updatedState!.stages['review'].taskIssues![0];
  t.is(task.status, TaskStatus.COMPLETED);
  t.truthy(task.completedAt);
});

test('updateTaskStatus throws error for nonexistent task', async (t) => {
  const { taskManager, stateManager } = t.context as any;

  const state = createTestState(123);
  stateManager.setState(state);

  await t.throwsAsync(
    async () => {
      await taskManager.updateTaskStatus(123, 9999, TaskStatus.COMPLETED);
    },
    {
      message: /Task issue #9999 not found/,
    },
  );
});

test('getTaskSummary returns accurate summary', async (t) => {
  const { taskManager, stateManager } = t.context as any;

  const state = createTestState(123);
  state.stages['review']!.taskIssues = [
    {
      number: 1001,
      title: 'Task 1',
      status: TaskStatus.COMPLETED,
      parentIssue: 123,
      stage: 'review',
      createdAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
      url: 'https://github.com/test/test/issues/1001',
    },
    {
      number: 1002,
      title: 'Task 2',
      status: TaskStatus.OPEN,
      parentIssue: 123,
      stage: 'review',
      createdAt: new Date().toISOString(),
      url: 'https://github.com/test/test/issues/1002',
    },
    {
      number: 1003,
      title: 'Task 3',
      status: TaskStatus.OPEN,
      parentIssue: 123,
      stage: 'review',
      createdAt: new Date().toISOString(),
      url: 'https://github.com/test/test/issues/1003',
    },
  ];
  stateManager.setState(state);

  const summary = await taskManager.getTaskSummary(123, 'review');

  t.is(summary.total, 3);
  t.is(summary.completed, 1);
  t.is(summary.remaining, 2);
  t.is(summary.tasks.length, 3);
});

test('interpolate handles missing variables gracefully', async (t) => {
  const { taskManager, stateManager } = t.context as any;

  const state = createTestState(123);
  stateManager.setState(state);

  const template: TaskTemplate[] = [
    {
      title: 'Process {{action}} for {{name}}',
      body: 'Missing {{missingVar}}',
      labels: ['task'],
    },
  ];

  const tasks = await taskManager.createTaskIssues(
    123,
    'review',
    template,
    undefined,
    { action: 'test' }, // name and missingVar not provided
  );

  // Should keep placeholders for missing variables
  t.is(tasks[0].title, 'Process test for {{name}}');
});
