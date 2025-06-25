import type { Octokit } from '@octokit/rest';
import test from 'ava';
import {
  addLabelsToIssue,
  determineLabelsToChange,
  getExistingLabels,
  removeLabelFromIssue,
  setLabels,
} from '../src/github.js';
import type { ValidationResult } from '../src/schema.js';

// Mock Octokit for testing
class MockOctokit {
  rest = {
    issues: {
      addLabels: async () => ({ data: [] }),
      removeLabel: async () => ({ data: [] }),
      listLabelsOnIssue: async () => ({ data: [] }),
    },
    repos: {
      createLabel: async () => ({ data: { name: 'test-label' } }),
    },
  };
}

// Test the pure logic function
test('determineLabelsToChange adds validation failing label when validation fails', (t) => {
  const result: ValidationResult = {
    success: false,
    errors: { formErrors: ['error'], fieldErrors: {} },
  };
  const existingLabels: string[] = [];

  const { toAdd, toRemove } = determineLabelsToChange(result, existingLabels);

  t.deepEqual(toAdd, ['status: validation failing']);
  t.deepEqual(toRemove, []);
});

test('determineLabelsToChange removes validation failing label when validation succeeds', (t) => {
  const result: ValidationResult = { success: true };
  const existingLabels = ['status: validation failing', 'other-label'];

  const { toAdd, toRemove } = determineLabelsToChange(result, existingLabels);

  t.deepEqual(toAdd, []);
  t.deepEqual(toRemove, ['status: validation failing']);
});

test('determineLabelsToChange does nothing when validation fails but label already exists', (t) => {
  const result: ValidationResult = {
    success: false,
    errors: { formErrors: ['error'], fieldErrors: {} },
  };
  const existingLabels = ['status: validation failing'];

  const { toAdd, toRemove } = determineLabelsToChange(result, existingLabels);

  t.deepEqual(toAdd, []);
  t.deepEqual(toRemove, []);
});

test('determineLabelsToChange does nothing when validation succeeds and no failing label exists', (t) => {
  const result: ValidationResult = { success: true };
  const existingLabels = ['other-label'];

  const { toAdd, toRemove } = determineLabelsToChange(result, existingLabels);

  t.deepEqual(toAdd, []);
  t.deepEqual(toRemove, []);
});

test('determineLabelsToChange adds label result for warnings and success true', (t) => {
  const result: ValidationResult = {
    success: true,
    data: {
      displayName: 'Test Path',
      discovery: {
        data: [[]] as string[][],
        warnings: ['This is a warning'],
      },
      arcgisOnline: {
        data: [[]] as string[][],
        warnings: [],
      },
    },
  };
  const existingLabels = ['status: validation failing'] as string[];

  const { toAdd, toRemove } = determineLabelsToChange(result, existingLabels);

  t.deepEqual(
    toAdd,
    ['status: discovery failing'],
    'Expected discovery failing label to be added',
  );
  t.deepEqual(
    toRemove,
    ['status: validation failing'],
    'Expected validation failing label to be removed',
  );
});

// Test GitHub API wrapper functions
test('addLabelsToIssue calls octokit with correct parameters', async (t) => {
  let addLabelsCallArgs = null;
  const mockOctokit = {
    rest: {
      issues: {
        addLabels: async (args: string) => {
          addLabelsCallArgs = args;
          return { data: {} };
        },
      },
    },
  } as unknown as Octokit;

  await addLabelsToIssue(mockOctokit, 'owner', 'repo', 123, [
    'test-label',
    'another-label',
  ]);

  t.deepEqual(addLabelsCallArgs, {
    owner: 'owner',
    repo: 'repo',
    issue_number: 123,
    labels: ['test-label', 'another-label'],
  });
});

test('addLabelsToIssue does nothing when labels array is empty', async (t) => {
  let addLabelsCalled = false;
  const mockOctokit = {
    rest: {
      issues: {
        addLabels: async () => {
          addLabelsCalled = true;
          return { data: {} };
        },
      },
    },
  } as unknown as Octokit;

  await addLabelsToIssue(mockOctokit, 'owner', 'repo', 123, []);

  t.false(addLabelsCalled);
});

test('removeLabelFromIssue calls octokit with correct parameters', async (t) => {
  let removeLabelCallArgs = null;
  const mockOctokit = {
    rest: {
      issues: {
        removeLabel: async (args: string) => {
          removeLabelCallArgs = args;
          return { data: {} };
        },
      },
    },
  } as unknown as Octokit;

  await removeLabelFromIssue(mockOctokit, 'owner', 'repo', 123, 'test-label');

  t.deepEqual(removeLabelCallArgs, {
    owner: 'owner',
    repo: 'repo',
    issue_number: 123,
    name: 'test-label',
  });
});

test('getExistingLabels returns label names correctly', async (t) => {
  const mockOctokit = {
    rest: {
      issues: {
        listLabelsOnIssue: async () => ({
          data: [
            { name: 'bug', color: 'red' },
            { name: 'feature', color: 'green' },
            { name: 'status: validation failing', color: 'orange' },
          ],
        }),
      },
    },
  } as unknown as Octokit;

  const labels = await getExistingLabels(mockOctokit, 'owner', 'repo', 123);

  t.deepEqual(labels, ['bug', 'feature', 'status: validation failing']);
});

// Test the integrated setLabels function
test('setLabels adds validation failing label when validation fails', async (t) => {
  let addLabelsCallArgs = null;
  let createDefaultLabelsCalled = false;
  let getLabelsCallArgs = null;

  const mockOctokit = {
    rest: {
      issues: {
        listLabelsOnIssue: async (args: { owner: string; repo: string }) => {
          getLabelsCallArgs = args;
          return { data: [{ name: 'existing-label' }] };
        },
        addLabels: async (args: string) => {
          addLabelsCallArgs = args;
          return { data: {} };
        },
      },
    },
  } as unknown as Octokit;

  const mockCreateDefaultLabels = async () => {
    createDefaultLabelsCalled = true;
  };

  const result: ValidationResult = {
    success: false,
    errors: { formErrors: ['error'], fieldErrors: {} },
  };

  const response = await setLabels('123', result, {
    octokit: mockOctokit,
    githubRepository: 'owner/repo',
    createDefaultLabels: mockCreateDefaultLabels,
  });

  t.true(createDefaultLabelsCalled);
  t.deepEqual(getLabelsCallArgs, {
    owner: 'owner',
    repo: 'repo',
    issue_number: 123,
  });
  t.deepEqual(addLabelsCallArgs, {
    owner: 'owner',
    repo: 'repo',
    issue_number: 123,
    labels: ['status: validation failing'],
  });
  t.deepEqual(response, { added: ['status: validation failing'], removed: [] });
});

test('setLabels removes validation failing label when validation succeeds', async (t) => {
  let removeLabelCallArgs = null;
  let addLabelsCalled = false;

  const mockOctokit = {
    rest: {
      issues: {
        listLabelsOnIssue: async () => ({
          data: [
            { name: 'status: validation failing' },
            { name: 'other-label' },
          ],
        }),
        removeLabel: async (args: string) => {
          removeLabelCallArgs = args;
          return { data: {} };
        },
        addLabels: async () => {
          addLabelsCalled = true;
          return { data: {} };
        },
      },
    },
  } as unknown as Octokit;

  const result: ValidationResult = { success: true };

  const response = await setLabels('456', result, {
    octokit: mockOctokit,
    githubRepository: 'owner/repo',
    createDefaultLabels: async () => {},
  });

  t.false(addLabelsCalled);
  t.deepEqual(removeLabelCallArgs, {
    owner: 'owner',
    repo: 'repo',
    issue_number: 456,
    name: 'status: validation failing',
  });
  t.deepEqual(response, { added: [], removed: ['status: validation failing'] });
});

test('setLabels returns empty arrays when no changes needed', async (t) => {
  const mockOctokit = {
    rest: {
      issues: {
        listLabelsOnIssue: async () => ({
          data: [{ name: 'other-label' }],
        }),
      },
    },
  } as unknown as Octokit;

  const result: ValidationResult = { success: true };

  const response = await setLabels('789', result, {
    octokit: mockOctokit,
    githubRepository: 'owner/repo',
    createDefaultLabels: async () => {},
  });

  t.deepEqual(response, { added: [], removed: [] });
});

test('setLabels throws error for invalid repository format', async (t) => {
  const mockOctokit = {} as unknown as Octokit;
  const result: ValidationResult = { success: true };

  await t.throwsAsync(
    () =>
      setLabels('123', result, {
        octokit: mockOctokit,
        githubRepository: 'invalid-format',
        createDefaultLabels: async () => {},
      }),
    { message: 'Invalid GitHub repository format: invalid-format' },
  );
});

test('setLabels handles invalid repository format', async (t) => {
  const result: ValidationResult = { success: true };

  await t.throwsAsync(
    setLabels('123', result, {
      octokit: new MockOctokit() as unknown as Octokit,
      githubRepository: 'invalid-format',
      createDefaultLabels: async () => {},
    }),
  );
});

test('setLabels rethrows errors from GitHub API', async (t) => {
  const mockOctokit = {
    rest: {
      issues: {
        listLabelsOnIssue: async () => {
          throw new Error('GitHub API Error');
        },
      },
    },
  } as unknown as Octokit;

  const result: ValidationResult = { success: true };

  await t.throwsAsync(
    () =>
      setLabels('123', result, {
        octokit: mockOctokit,
        githubRepository: 'owner/repo',
        createDefaultLabels: async () => {},
      }),
    { message: 'GitHub API Error' },
  );
});
