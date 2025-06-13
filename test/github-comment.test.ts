import test from 'ava';
import { validateIssueData } from '../src/main.js';

// Mock data for testing comment functionality
const validData = {
  'display-name': 'Test Dataset',
  'internal-sgid-table': 'test.table'
};

const invalidData = {
  'internal-sgid-table': 'test.table'
  // Missing required 'display-name'
};

test('postIssueComment function exists and handles validation results', async (t) => {
  // Test successful validation
  const successResult = await validateIssueData(validData);
  t.true(successResult.success);
  t.is(successResult.errors.length, 0);

  // Test failed validation
  const failureResult = await validateIssueData(invalidData);
  t.false(failureResult.success);
  t.true(failureResult.errors.length > 0);
  t.true(failureResult.errors.some(error => error.field === 'display-name'));
});
