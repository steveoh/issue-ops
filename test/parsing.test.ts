import test from 'ava';
import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { parseIssueTemplate } from '../src/main.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

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
  t.is(result['arcgis-online-id'], '0df199cef1704e5287ae675ee3dbd3bd');
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

  // Verify that non-IssueData fields are not included
  // @ts-expect-error
  t.is(result['reasons-for-deprecation'], undefined);
  // @ts-expect-error
  t.is(result['source'], undefined);
  // @ts-expect-error
  t.is(result['other-source-details'], undefined);
  // @ts-expect-error
  t.is(result['migration-guide-(replacement)'], undefined);

  // Verify that _No response_ fields are not included
  t.is(result['archives-record-series'], undefined);
});

test('parseIssueTemplate handles empty input', (t) => {
  const empty = {
    'display-name': '',
    'internal-sgid-table': '',
    'open-sgid-table': undefined,
    'arcgis-online-id': undefined,
    'sgid-on-arcgis-url': undefined,
    'product-page-url': undefined,
    'sgid-index-id': undefined,
    'archives-record-series': undefined,
  };

  const result = parseIssueTemplate([]);
  t.deepEqual(result, empty);
});

test('parseIssueTemplate handles malformed input', (t) => {
  const empty = {
    'display-name': '',
    'internal-sgid-table': '',
    'open-sgid-table': undefined,
    'arcgis-online-id': undefined,
    'sgid-on-arcgis-url': undefined,
    'product-page-url': undefined,
    'sgid-index-id': undefined,
    'archives-record-series': undefined,
  };
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

  // Should exclude non-IssueData fields
  t.false('reasons-for-deprecation' in result);
  t.false('source' in result);
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
  ];

  const result = parseIssueTemplate(inputWithCommentsAndPlaceholders);

  // Should include valid values
  t.is(result['display-name'], 'Actual Dataset Name');
  t.is(result['sgid-index-id'], 'valid-id-123');

  // Should exclude fields with _No response_ or placeholder text
  t.is(result['arcgis-online-id'], undefined);
  t.is(result['open-sgid-table'], undefined);
});
