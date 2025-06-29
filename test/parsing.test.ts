import test from 'ava';
import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { parseIssueTemplate } from '../src/parsing.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const empty = {
  'display-name': '',
  'internal-sgid-table': '',
  'historic-relevance': '',
  'open-sgid-table': undefined,
  'arcgis-online-item-id': undefined,
  'sgid-on-arcgis-url': undefined,
  'product-page-url': undefined,
  'sgid-index-id': undefined,
  'archives-record-series': undefined,
  source: [],
};

test('parseIssueTemplate parses only IssueData fields from issue body correctly', (t) => {
  // Read the test data from the source directory
  const issueBodyPath = join(
    __dirname,
    '..',
    '..',
    'test',
    'data',
    'issue-body.md',
  );
  const issueBody = readFileSync(issueBodyPath, 'utf-8');

  // Parse the issue data
  const result = parseIssueTemplate(issueBody.split('\n'));

  if (!result) {
    t.fail('Result should not be undefined');

    return;
  }

  // Verify only IssueData interface fields are extracted
  t.is(result['display-name'], 'Utah Avalanche Paths');
  t.is(result['internal-sgid-table'], 'geosciene.AvalanchePaths');
  t.is(result['arcgis-online-item-id'], '0df199cef1704e5287ae675ee3dbd3bd');
  t.is(
    result['sgid-on-arcgis-url'],
    'https://opendata.gis.utah.gov/datasets/utah-avalanche-paths/about',
  );
  t.is(
    result['product-page-url'],
    'https://gis.utah.gov/products/sgid/geoscience/avalanche-paths/',
  );
  t.is(result['open-sgid-table'], 'geoscience.avalanche_paths');
  t.is(result['sgid-index-id'], '8081a767-ef27-4a17-acb1-88d90c5ed902');
  t.is(result['historic-relevance'], 'No');

  // Verify that non-IssueData fields are not included
  t.false('reasons-for-deprecation' in result);
  t.deepEqual(result['source'], ['Manual']);
  t.false('other-source-details' in result);
  t.false('migration-guide-(replacement)' in result);

  // Verify that _No response_ fields are not included
  t.is(result['archives-record-series'], undefined);
});

test('parseIssueTemplate handles empty input', (t) => {
  const result = parseIssueTemplate([]);
  t.deepEqual(result, empty);
});

test('parseIssueTemplate handles malformed input', (t) => {
  const malformedInput = [
    'Not a header',
    'Still not a header',
    '## Wrong header level',
    'Random text',
  ];

  const result = parseIssueTemplate(malformedInput);
  t.deepEqual(result, empty);
});

test('parseIssueTemplate only includes IssueData interface fields', (t) => {
  const inputWithMixedFields = [
    '### Display Name',
    'Test Dataset',
    '### Internal SGID Table',
    'test.table',
    '### Reasons for Deprecation',
    'This should be excluded',
    '### Source',
    '- [x] Manual',
    '### Random Field Not In Interface',
    'This should also be excluded',
    '### SGID Index ID',
    'test-id-123',
    '### Historic Relevance',
    'Yes',
  ];

  const result = parseIssueTemplate(inputWithMixedFields);

  if (!result) {
    t.fail('Result should not be undefined');

    return;
  }

  // Should include IssueData interface fields
  t.is(result['display-name'], 'Test Dataset');
  t.is(result['internal-sgid-table'], 'test.table');
  t.is(result['sgid-index-id'], 'test-id-123');
  t.is(result['historic-relevance'], 'Yes');
  t.deepEqual(result['source'], ['Manual']);

  // Should exclude non-IssueData fields
  t.false('reasons-for-deprecation' in result);
  t.false('random-field-not-in-interface' in result);
});

test('parseIssueTemplate ignores comments and placeholders for IssueData fields', (t) => {
  const inputWithCommentsAndPlaceholders = [
    '### Display Name',
    '<!-- This is a comment -->',
    'Actual Dataset Name',
    '### Internal SGID Table',
    '_No response_',
    '### Open SGID Table',
    'Contains placeholder text',
    '### SGID Index ID',
    'valid-id-123',
    '### Historic Relevance',
    'Yes',
  ];

  const result = parseIssueTemplate(inputWithCommentsAndPlaceholders);

  // Should include valid values
  t.is(result['display-name'], 'Actual Dataset Name');
  t.is(result['sgid-index-id'], 'valid-id-123');

  // Should exclude fields with _No response_ or placeholder text
  t.is(result['arcgis-online-item-id'], undefined);
  t.is(result['open-sgid-table'], undefined);
});

test('parseIssueTemplate handles checkboxes in source field', (t) => {
  const inputWithCheckboxes = [
    '### Source',
    '- [x] Manual',
    '- [ ] Farm from AGOL',
    '- [x] Other',
    '### Other Source Details',
    'this goes in source field',
    '### Internal SGID Table',
    'test.source_table',
    '### Historic Relevance',
    'Yes',
  ];

  const result = parseIssueTemplate(inputWithCheckboxes);

  if (!result) {
    t.fail('Result should not be undefined');

    return;
  }

  t.deepEqual(result['source'], ['Manual', 'this goes in source field']);
  t.is(result['display-name'], '');
  t.is(result['internal-sgid-table'], 'test.source_table');
});
