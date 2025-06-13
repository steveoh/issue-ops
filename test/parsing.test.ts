import test from 'ava';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { parseIssueTemplate } from '../src/main.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

test('parseIssueTemplate parses only IssueData fields from issue body correctly', async (t) => {
  // Read the test data from the source directory
  const issueBodyPath = join(__dirname, '..', '..', 'test', 'data', 'issue-body.md');
  const issueBody = readFileSync(issueBodyPath, 'utf-8');

  // Parse the issue data
  const result = parseIssueTemplate(issueBody.split('\n'));

  // Verify only IssueData interface fields are extracted
  t.is(result['display-name'], 'Utah Avalanche Paths');
  t.is(result['internal-sgid-table'], 'geosciene.AvalanchePaths');
  t.is(result['arcgis-online-url'], 'https://www.arcgis.com/home/item.html?id=0df199cef1704e5287ae675ee3dbd3bd');
  t.is(result['sgid-on-arcgis-url'], 'https://opendata.gis.utah.gov/datasets/utah-avalanche-paths/about');
  t.is(result['product-page-url-(gis.utah.gov)'], 'https://gis.utah.gov/products/sgid/geoscience/avalanche-paths/');
  t.is(result['open-sgid-table'], 'geoscience.avalanche_paths');
  t.is(result['sgid-index-id'], '8081a767-ef27-4a17-acb1-88d90c5ed902');

  // Verify that non-IssueData fields are not included
  t.is(result['reasons-for-deprecation'], undefined);
  t.is(result['source'], undefined);
  t.is(result['other-source-details'], undefined);
  t.is(result['migration-guide-(replacement)'], undefined);

  // Verify that _No response_ fields are not included
  t.is(result['archives-record-series'], undefined);

  // Verify the number of extracted fields matches IssueData props only
  const expectedFieldCount = 7; // Number of fields with actual values from IssueData interface
  t.is(Object.keys(result).length, expectedFieldCount);
});

test('parseIssueTemplate handles empty input', (t) => {
  const result = parseIssueTemplate([]);
  t.deepEqual(result, {});
});

test('parseIssueTemplate handles malformed input', (t) => {
  const malformedInput = [
    'Not a header',
    'Still not a header',
    '## Wrong header level',
    'Random text'
  ];

  const result = parseIssueTemplate(malformedInput);
  t.deepEqual(result, {});
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
    'test-id-123'
  ];

  const result = parseIssueTemplate(inputWithMixedFields);

  // Should include IssueData interface fields
  t.is(result['display-name'], 'Test Dataset');
  t.is(result['internal-sgid-table'], 'test.table');
  t.is(result['sgid-index-id'], 'test-id-123');

  // Should exclude non-IssueData fields
  t.is(result['reasons-for-deprecation'], undefined);
  t.is(result['source'], undefined);
  t.is(result['random-field-not-in-interface'], undefined);

  // Should only have the IssueData fields that were provided
  t.is(Object.keys(result).length, 3);
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
    'valid-id-123'
  ];

  const result = parseIssueTemplate(inputWithCommentsAndPlaceholders);

  // Should include valid values
  t.is(result['display-name'], 'Actual Dataset Name');
  t.is(result['sgid-index-id'], 'valid-id-123');

  // Should exclude fields with _No response_ or placeholder text
  t.is(result['internal-sgid-table'], undefined);
  t.is(result['open-sgid-table'], undefined);

  // Should only have 2 valid fields
  t.is(Object.keys(result).length, 2);
});
