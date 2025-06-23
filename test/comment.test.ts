import test from 'ava';
import { generateCommentBody, postIssueComment } from '../src/main.js';

// Mock Octokit for testing
class MockOctokit {
  rest = {
    issues: {
      listComments: async () => ({ data: [] }),
      createComment: async () => ({ data: { id: 123 } }),
      updateComment: async () => ({ data: { id: 123 } }),
    },
  };
}

test('generateCommentBody creates success markdown for valid data', async (t) => {
  const validResult = {
    success: true,
    data: {
      displayName: 'Utah Avalanche Paths',
      discovery: {
        data: [
          ['sgid product', 'data', 'status'],
          ['Open SGID', 'Not published', '❌'],
          [
            'gis.utah.gov',
            `[product page](https://gis.utah.gov/products/sgid/geoscience/avalanche-paths/)`,
            '✅',
          ],
          ['SGID Index', '', '❌'],
        ],
        warnings: [
          `Open SGID table "geoscience.avalanche_paths" was not found in the Open SGID database`,
          `SGID Index Id "23424" does not exist in the SGID Index`,
        ],
      },
      arcgisOnline: {
        data: [
          ['setting', 'value', 'status'],
          [
            'ItemId',
            `[123](https://www.arcgis.com/home/item.html?id=1234?f=json)`,
            '✅',
          ],
          ['Sharing', 'public', '✅'],
          ['Groups', 'group1, group2', '✅'],
        ],
        warnings: ['test warning'],
      },
    },
  };

  const commentBody = generateCommentBody(validResult);

  // Check that it contains the validation marker
  t.true(commentBody.includes('<!-- issue-ops-validation-comment -->'));

  // Check that it shows success
  t.true(commentBody.includes('✅ Nice work!'));
  t.true(
    commentBody.includes(
      'The deprecation data has been successfully validated!',
    ),
  );

  // Check that it includes the product table headings
  t.true(commentBody.includes('| sgid product | data | status |'));

  t.true(commentBody.includes('| Open SGID | Not published | ❌ |'));
  t.true(
    commentBody.includes(
      '| gis.utah.gov | [product page](https://gis.utah.gov/products/sgid/geoscience/avalanche-paths/) | ✅ |',
    ),
  );
  t.true(commentBody.includes('| SGID Index | | ❌ |'));

  t.true(commentBody.includes('### SGID Product Warnings'));
  t.true(commentBody.includes('- Open SGID table'));
  t.true(commentBody.includes('- SGID Index Id'));

  // Check ArcGIS Online section
  t.true(commentBody.includes('### ArcGIS Online'));
  t.true(commentBody.includes('| setting | value | status |'));
  t.true(
    commentBody.includes(
      '| ItemId | [123](https://www.arcgis.com/home/item.html?id=1234?f=json) | ✅ |',
    ),
  );
  t.true(commentBody.includes('| Sharing | public | ✅ |'));
  t.true(commentBody.includes('| Groups | group1, group2 | ✅ |'));
});

test('generateCommentBody creates failure markdown for invalid data', async (t) => {
  const invalidResult = {
    success: false,
    errors: {
      formErrors: [],
      fieldErrors: {
        'open-sgid-table': [
          'Open SGID table name must be in the format "schema.table" with a single period',
        ],
        'arcgis-online-id': ['ArcGIS Online ItemId must be a valid UUID'],
      },
    },
  };

  const commentBody = generateCommentBody(invalidResult);

  // Check that it contains the validation marker
  t.true(
    commentBody.includes('<!-- issue-ops-validation-comment -->'),
    'The marker should always be present',
  );

  // Check that it shows failure
  t.true(
    commentBody.includes('❌ Validation Failed'),
    'The title should indicate validation failure',
  );
  t.true(
    commentBody.includes('There were validation errors found.'),
    'The comment should indicate validation errors',
  );

  // Check that it includes the error messages
  t.true(
    commentBody.includes('### Input Validation Errors'),
    'Show the title for input validation errors',
  );
  t.true(
    commentBody.includes(
      '- **open-sgid-table**: Open SGID table name must be in the format "schema.table" with a single period',
    ),
    'The list items should be present',
  );
  t.true(
    commentBody.includes(
      '- **arcgis-online-id**: ArcGIS Online ItemId must be a valid UUID',
    ),
    'The list items should be present',
  );
});

test('postIssueComment skips when missing GitHub context', async (t) => {
  const validResult = {
    success: true,
    data: {
      displayName: 'Utah Test',
      discovery: { data: [], warnings: [] },
      arcgisOnline: { data: [], warnings: [] },
    },
  };

  // Test with no octokit
  await t.notThrowsAsync(postIssueComment(validResult, { octokit: null }));

  // Test with no repository
  await t.notThrowsAsync(
    postIssueComment(validResult, {
      octokit: new MockOctokit() as any,
      githubRepository: undefined,
    }),
  );

  // Test with no issue number
  await t.notThrowsAsync(
    postIssueComment(validResult, {
      octokit: new MockOctokit() as any,
      githubRepository: 'owner/repo',
      issueNumber: undefined,
    }),
  );
});

test('postIssueComment handles invalid repository format', async (t) => {
  const validResult = {
    success: true,
    data: {
      displayName: 'Utah Test',
      discovery: { data: [], warnings: [] },
      arcgisOnline: { data: [], warnings: [] },
    },
  };

  await t.notThrowsAsync(
    postIssueComment(validResult, {
      octokit: new MockOctokit() as any,
      githubRepository: 'invalid-format',
      issueNumber: '123',
    }),
  );
});

test('postIssueComment creates new comment when no existing comment found', async (t) => {
  let createCommentCalled = false;
  let updateCommentCalled = false;

  const mockOctokit = {
    rest: {
      issues: {
        listComments: async () => ({ data: [] }),
        createComment: async (params: any) => {
          createCommentCalled = true;
          t.is(params.owner, 'test-owner');
          t.is(params.repo, 'test-repo');
          t.is(params.issue_number, 123);
          t.true(params.body.includes('<!-- issue-ops-validation-comment -->'));
          return { data: { id: 456 } };
        },
        updateComment: async () => {
          updateCommentCalled = true;
          return { data: { id: 456 } };
        },
      },
    },
  };

  const validResult = {
    success: true,
    data: {
      displayName: 'Utah Test',
      discovery: { data: [['test', 'data', 'status']], warnings: [] },
      arcgisOnline: { data: [['test', 'data', 'status']], warnings: [] },
    },
  };

  await postIssueComment(validResult, {
    octokit: mockOctokit as any,
    githubRepository: 'test-owner/test-repo',
    issueNumber: '123',
  });

  t.true(
    createCommentCalled,
    'Should call createComment when no existing comment',
  );
  t.false(
    updateCommentCalled,
    'Should not call updateComment when no existing comment',
  );
});

test('postIssueComment updates existing comment when bot comment found', async (t) => {
  let createCommentCalled = false;
  let updateCommentCalled = false;

  const existingComment = {
    id: 789,
    body: '<!-- issue-ops-validation-comment -->\nExisting comment',
    user: {
      login: 'github-actions[bot]',
      type: 'Bot',
    },
  };

  const mockOctokit = {
    rest: {
      issues: {
        listComments: async () => ({ data: [existingComment] }),
        createComment: async () => {
          createCommentCalled = true;
          return { data: { id: 456 } };
        },
        updateComment: async (params: any) => {
          updateCommentCalled = true;
          t.is(params.owner, 'test-owner');
          t.is(params.repo, 'test-repo');
          t.is(params.comment_id, 789);
          t.true(params.body.includes('<!-- issue-ops-validation-comment -->'));
          return { data: { id: 789 } };
        },
      },
    },
  };

  const validResult = {
    success: false,
    errors: {
      formErrors: ['Test error'],
      fieldErrors: {},
    },
  };

  await postIssueComment(validResult, {
    octokit: mockOctokit as any,
    githubRepository: 'test-owner/test-repo',
    issueNumber: '123',
  });

  t.false(
    createCommentCalled,
    'Should not call createComment when existing comment found',
  );
  t.true(
    updateCommentCalled,
    'Should call updateComment when existing comment found',
  );
});

test('postIssueComment ignores non-bot existing comments', async (t) => {
  let createCommentCalled = false;
  let updateCommentCalled = false;

  const existingUserComment = {
    id: 999,
    body: '<!-- issue-ops-validation-comment -->\nUser comment',
    user: {
      login: 'regular-user',
      type: 'User',
    },
  };

  const mockOctokit = {
    rest: {
      issues: {
        listComments: async () => ({ data: [existingUserComment] }),
        createComment: async () => {
          createCommentCalled = true;
          return { data: { id: 456 } };
        },
        updateComment: async () => {
          updateCommentCalled = true;
          return { data: { id: 999 } };
        },
      },
    },
  };

  const validResult = {
    success: true,
    data: {
      displayName: 'Utah Test',
      discovery: { data: [], warnings: [] },
      arcgisOnline: { data: [], warnings: [] },
    },
  };

  await postIssueComment(validResult, {
    octokit: mockOctokit as any,
    githubRepository: 'test-owner/test-repo',
    issueNumber: '123',
  });

  t.true(
    createCommentCalled,
    'Should create new comment when only user comments exist',
  );
  t.false(updateCommentCalled, 'Should not update user comments');
});

test('postIssueComment handles API errors gracefully', async (t) => {
  const mockOctokit = {
    rest: {
      issues: {
        listComments: async () => {
          throw new Error('API Error');
        },
        createComment: async () => ({ data: { id: 456 } }),
        updateComment: async () => ({ data: { id: 789 } }),
      },
    },
  };

  const validResult = {
    success: true,
    data: {
      displayName: 'Utah Test',
      discovery: { data: [], warnings: [] },
      arcgisOnline: { data: [], warnings: [] },
    },
  };

  await t.notThrowsAsync(
    postIssueComment(validResult, {
      octokit: mockOctokit as any,
      githubRepository: 'test-owner/test-repo',
      issueNumber: '123',
    }),
  );
});
