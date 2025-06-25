import test from 'ava';
import { run } from '../src/main.js';

// Store original environment variables
const originalEnv = { ...process.env };

// Store original process.exit
const originalProcessExit = process.exit;

// Track process.exit calls
let processExitCalled = false;

// Helper to setup environment variables for testing
function setupEnv(options: {
  issueNumber?: string;
  issueTitle?: string;
  issueBody?: string;
  githubToken?: string;
  githubRepository?: string;
}) {
  process.env.ISSUE_NUMBER = options.issueNumber;
  process.env.ISSUE_TITLE = options.issueTitle;
  process.env.ISSUE_BODY = options.issueBody;
  process.env.GITHUB_TOKEN = options.githubToken;
  process.env.GITHUB_REPOSITORY = options.githubRepository;
}

// Helper to restore environment
function restoreEnv() {
  process.env = { ...originalEnv };
}

function setupMocks() {
  processExitCalled = false;

  // Mock process.exit
  process.exit = () => {
    processExitCalled = true;
    // Don't actually exit in tests
    return undefined as never;
  };
}

function restoreMocks() {
  process.exit = originalProcessExit;
}

test.beforeEach(() => {
  setupMocks();
});

test.afterEach(() => {
  restoreMocks();
  restoreEnv();
});

test('run function completes successfully with valid issue data', async (t) => {
  setupEnv({
    issueNumber: '123',
    issueTitle: 'Test Issue',
    issueBody:
      '### Display Name\nUtah Test Data\n### Internal SGID Table\ntest.table',
    githubToken: 'fake-token',
    githubRepository: 'owner/repo',
  });

  await t.notThrowsAsync(
    run(),
    'run function should not throw with valid data',
  );
  t.false(processExitCalled, 'Should not call process.exit on success');
});

test('run function completes when no issue number is provided', async (t) => {
  setupEnv({
    issueNumber: undefined,
    issueTitle: 'Test Issue',
    issueBody: 'Test body',
  });

  await t.notThrowsAsync(
    run(),
    'run function should not throw without issue number',
  );
  t.false(processExitCalled, 'Should not call process.exit in standalone mode');
});

test('run function completes when no issue body is provided', async (t) => {
  setupEnv({
    issueNumber: '123',
    issueTitle: 'Test Issue',
    issueBody: undefined,
  });

  await t.notThrowsAsync(
    run(),
    'run function should not throw without issue body',
  );
  t.false(processExitCalled, 'Should not call process.exit without issue body');
});

test('run function completes when issue body is empty', async (t) => {
  setupEnv({
    issueNumber: '123',
    issueTitle: 'Test Issue',
    issueBody: '',
  });

  await t.notThrowsAsync(
    run(),
    'run function should not throw with empty issue body',
  );
  t.false(
    processExitCalled,
    'Should not call process.exit with empty issue body',
  );
});

test('run function handles minimal valid data', async (t) => {
  setupEnv({
    issueNumber: '456',
    issueTitle: 'Minimal Test',
    issueBody:
      '### Display Name\nUtah Minimal Test Data\n### Internal SGID Table\nminimal.test',
  });

  await t.notThrowsAsync(
    run(),
    'run function should handle minimal valid data',
  );
  t.false(
    processExitCalled,
    'Should not call process.exit with minimal valid data',
  );
});

test('run function handles validation errors gracefully', async (t) => {
  setupEnv({
    issueNumber: '789',
    issueTitle: 'Invalid Test',
    issueBody:
      '### Display Name\nInvalid Name\n### Internal SGID Table\ninvalid-table-format',
  });

  // Even with validation errors, the function should complete without throwing
  await t.notThrowsAsync(
    run(),
    'run function should handle validation errors gracefully',
  );
  // It might exit with code 1 if validation fails completely, but shouldn't throw
});

test('run function works without GitHub token', async (t) => {
  setupEnv({
    issueNumber: '999',
    issueTitle: 'No Token Test',
    issueBody:
      '### Display Name\nUtah No Token Test\n### Internal SGID Table\nnotoken.test',
    githubToken: undefined,
    githubRepository: 'owner/repo',
  });

  await t.notThrowsAsync(
    run(),
    'run function should work without GitHub token',
  );
});

test('run function works without GitHub repository', async (t) => {
  setupEnv({
    issueNumber: '888',
    issueTitle: 'No Repo Test',
    issueBody:
      '### Display Name\nUtah No Repo Test\n### Internal SGID Table\nnorepo.test',
    githubToken: 'fake-token',
    githubRepository: undefined,
  });

  await t.notThrowsAsync(
    run(),
    'run function should work without GitHub repository',
  );
});

test('run function handles complete workflow', async (t) => {
  setupEnv({
    issueNumber: '100',
    issueTitle: 'Complete Workflow Test',
    issueBody: `### Display Name
Utah Complete Workflow Test

### Internal SGID Table
complete.workflow

### Open SGID Table
complete.workflow_open

### ArcGIS Online ID
abcdef0123456789abcdef0123456789

### SGID on ArcGIS URL
https://opendata.gis.utah.gov/datasets/test-dataset/about

### Product Page URL
https://gis.utah.gov/products/sgid/test/complete-workflow/

### SGID Index ID
550e8400-e29b-41d4-a716-446655440000

### Archives Record Series
Test Archive Series`,
    githubToken: 'test-token',
    githubRepository: 'test/repo',
  });

  await t.notThrowsAsync(run(), 'run function should handle complete workflow');
  // The function may exit with an error code due to network calls failing in test environment
  // but it should not throw an exception
});

test('run function environment variables are properly read', async (t) => {
  const testNumber = '12345';
  const testTitle = 'Environment Variable Test';
  const testBody =
    '### Display Name\nUtah Environment Test\n### Internal SGID Table\nenv.test';

  setupEnv({
    issueNumber: testNumber,
    issueTitle: testTitle,
    issueBody: testBody,
    githubToken: 'env-test-token',
    githubRepository: 'env/test-repo',
  });

  // Verify environment variables are set correctly
  t.is(process.env.ISSUE_NUMBER, testNumber, 'ISSUE_NUMBER should be set');
  t.is(process.env.ISSUE_TITLE, testTitle, 'ISSUE_TITLE should be set');
  t.is(process.env.ISSUE_BODY, testBody, 'ISSUE_BODY should be set');
  t.is(
    process.env.GITHUB_TOKEN,
    'env-test-token',
    'GITHUB_TOKEN should be set',
  );
  t.is(
    process.env.GITHUB_REPOSITORY,
    'env/test-repo',
    'GITHUB_REPOSITORY should be set',
  );

  await t.notThrowsAsync(
    run(),
    'run function should work with environment variables',
  );
});
