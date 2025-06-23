import test from 'ava';
import type { IssueDataFields } from '../src/main.js';
import { validateAndTransform } from '../src/main.js';

const validMinimalData = {
  'display-name': 'Utah Avalanche Paths',
  'internal-sgid-table': 'geoscience.AvalanchePaths',
} as IssueDataFields;

const validCompleteData = {
  ...validMinimalData,
  'open-sgid-table': 'geoscience.avalanche_paths',
  'arcgis-online-id': '0df199cef1704e5287ae675ee3dbd3bd',
  'sgid-on-arcgis-url':
    'https://opendata.gis.utah.gov/datasets/utah-avalanche-paths/about',
  'product-page-url':
    'https://gis.utah.gov/products/sgid/geoscience/avalanche-paths/',
  'sgid-index-id': '8081a767-ef27-4a17-acb1-88d90c5ed902',
  'archives-record-series': 'Some archive series',
} as IssueDataFields;

const invalidUrlData = {
  ...validMinimalData,
  'sgid-on-arcgis-url': 'https://example.com',
  'product-page-url': 'https://wrong-domain.com',
} as IssueDataFields;

const invalidUuidData = {
  ...validMinimalData,
  'sgid-index-id': 'not-a-valid-uuid',
  'arcgis-online-id': 'nota-valid-uuid',
} as IssueDataFields;

const emptyRequiredData = {
  'display-name': '',
  'internal-sgid-table': '',
} as IssueDataFields;

test('validateAndTransform validates successfully with all valid data', async (t) => {
  const result = await validateAndTransform(validCompleteData);

  t.true(result.success);
  t.falsy(result.errors);
  t.truthy(result.data);
  t.is(result.data?.displayName, 'Utah Avalanche Paths');
});

test('validateAndTransform validates successfully with minimal valid data', async (t) => {
  const result = await validateAndTransform(validMinimalData);

  t.true(result.success);
  t.falsy(result.errors);
  t.truthy(result.data);
  t.is(result.data?.displayName, 'Utah Avalanche Paths');
});

test('validateAndTransform validates unsuccessfully with empty display name', async (t) => {
  const result = await validateAndTransform({
    ...validMinimalData,
    'display-name': '',
  });

  const displayNameErrors =
    (result.errors?.fieldErrors as any)?.['display-name'] ?? [];

  t.false(result.success);
  t.true(Object.keys(result.errors?.fieldErrors ?? {}).length > 0);
  t.true(displayNameErrors.includes('A longer display name is required'));
  t.true(
    displayNameErrors.includes(
      "Display name must start with 'Utah' followed by one or more words",
    ),
  );
});

test('validateAndTransform validates unsuccessfully with short display name', async (t) => {
  const result = await validateAndTransform({
    ...validMinimalData,
    'display-name': 'Utah',
  });

  const displayNameErrors =
    (result.errors?.fieldErrors as any)?.['display-name'] ?? [];

  t.false(result.success);
  t.true(Object.keys(result.errors?.fieldErrors ?? {}).length > 0);
  t.true(displayNameErrors.includes('A longer display name is required'));
  t.true(
    displayNameErrors.includes(
      "Display name must start with 'Utah' followed by one or more words",
    ),
  );
});

test('validateAndTransform validates unsuccessfully with invalid display name', async (t) => {
  const result = await validateAndTransform({
    ...validMinimalData,
    'display-name': 'Not Utah Avalanche Paths',
  });

  t.false(result.success);
  t.true(Object.keys(result.errors?.fieldErrors ?? {}).length > 0);
  t.is(
    (result.errors?.fieldErrors as any)?.['display-name']?.[0] ?? '',
    "Display name must start with 'Utah' followed by one or more words",
  );
});

test('validateAndTransform validates unsuccessfully with missing sgid table', async (t) => {
  const result = await validateAndTransform({
    ...validCompleteData,
    'internal-sgid-table': undefined as unknown as string,
  });

  t.false(result.success);
  t.true(Object.keys(result.errors?.fieldErrors ?? {}).length > 0);
  t.is(
    (result.errors?.fieldErrors as any)?.['internal-sgid-table']?.[0] ?? '',
    'Internal SGID table is required',
  );
});

test('validateAndTransform validates unsuccessfully with invalid sgid table', async (t) => {
  const result = await validateAndTransform({
    ...validCompleteData,
    'internal-sgid-table': 'table',
  });

  t.false(result.success);
  t.true(Object.keys(result.errors?.fieldErrors ?? {}).length > 0);
  t.is(
    (result.errors?.fieldErrors as any)?.['internal-sgid-table']?.[0] ?? '',
    'SGID table name must be in the format "schema.table" with a single period',
  );
});

test('validateAndTransform validates unsuccessfully when open sgid table is invalid', async (t) => {
  const result = await validateAndTransform({
    ...validMinimalData,
    'open-sgid-table': 'invalid_table',
  });

  t.false(result.success);
  t.true(Object.keys(result.errors?.fieldErrors ?? {}).length > 0);
  t.is(
    (result.errors?.fieldErrors as any)?.['open-sgid-table']?.[0] ?? '',
    'Open SGID table name must be in the format "schema.table" with a single period',
  );
});

test('validateAndTransform validates unsuccessfully with invalid UUID', async (t) => {
  const result = await validateAndTransform(invalidUuidData);

  const errors = Object.keys(result.errors?.fieldErrors ?? {});

  t.false(result.success);
  t.true(Object.keys(result.errors?.fieldErrors ?? {}).length == 2);
  t.true(errors.includes('sgid-index-id'));
  t.true(errors.includes('arcgis-online-id'));
});

test('validateAndTransform validates unsuccessfully with invalid gis.utah.gov url', async (t) => {
  let result = await validateAndTransform({
    ...validCompleteData,
    'product-page-url': 'https://wrong-domain.com',
  });

  t.false(result.success);
  t.true(Object.keys(result.errors?.fieldErrors ?? {}).length > 0);
  t.is(
    (result.errors?.fieldErrors as any)?.['product-page-url']?.[0] ?? '',
    'Product pages must be from gis.utah.gov',
  );
});

test('validateAndTransform transforms unsuccessfully when open sgid table is not found', async (t) => {
  const result = await validateAndTransform({
    ...validMinimalData,
    'open-sgid-table': 'water.non_existent_table',
  });

  t.true(
    result.success,
    'Validation should succeed even with non-existent open SGID table',
  );
  t.true(
    result.data?.discovery.data.some(
      (row) =>
        Array.isArray(row) &&
        row[0] === 'Open SGID' &&
        row[1] === 'water.non_existent_table' &&
        row[2] === '❌',
    ),
    'Discovery data should indicate the open SGID table does not exist',
  );
});

test('validateAndTransform transforms unsuccessfully when open sgid table is not accessible', async (t) => {
  const previousPassword = process.env.OPEN_SGID_PASSWORD;
  process.env.OPEN_SGID_PASSWORD = 'wrong-password'; // Simulate inaccessible table

  const result = await validateAndTransform({
    ...validMinimalData,
    'open-sgid-table': 'water.non_existent_table',
  });

  process.env.OPEN_SGID_PASSWORD = previousPassword; // Restore original password

  t.true(
    result.success,
    'Validation should succeed even with non-existent open SGID table',
  );
  t.true(
    result.data?.discovery.data.some(
      (row) =>
        Array.isArray(row) &&
        row[0] === 'Open SGID' &&
        row[1] === 'not accessible' &&
        row[2] === '❌',
    ),
    'Discovery data should indicate the Open SGID is not accessible',
  );
});

test('validateAndTransform transforms unsuccessfully when gis.utah.gov page is a redirect', async (t) => {
  const result = await validateAndTransform({
    ...validMinimalData,
    'product-page-url':
      'https://gis.utah.gov/products/sgid/transportation/uta-commuter-rail-stations/',
  });

  t.true(result.success, 'Validation should succeed with bad url');
  t.true(
    result.data?.discovery.data.some(
      (row) =>
        Array.isArray(row) && row[0] === 'gis.utah.gov' && row[2] === '❌',
    ),
    'Discovery data should indicate the url is bad',
  );
  t.true(
    result.data?.discovery.warnings.includes(
      'Product page URL contains redirects - please use the final destination URL',
    ),
    'Warning should indicate the product page URL is invalid',
  );
});

test('validateAndTransform transforms unsuccessfully when gis.utah.gov page is a 404', async (t) => {
  const result = await validateAndTransform({
    ...validMinimalData,
    'product-page-url':
      'https://gis.utah.gov/products/sgid/transportation/bad-url/',
  });

  t.true(result.success, 'Validation should succeed with bad url');
  t.true(
    result.data?.discovery.data.some(
      (row) =>
        Array.isArray(row) && row[0] === 'gis.utah.gov' && row[2] === '❌',
    ),
    'Discovery data should indicate the url is bad',
  );
  t.true(
    result.data?.discovery.warnings.includes(
      'Product page URL must return a 200 OK status',
    ),
    'Warning should indicate the product page URL is invalid',
  );
});

test('validateAndTransform transforms unsuccessfully when gis.utah.gov page is a bad', async (t) => {
  const result = await validateAndTransform({
    ...validMinimalData,
    'product-page-url':
      'https://bad.gis.utah.gov/products/sgid/transportation/bad-url/',
  });

  t.true(result.success, 'Validation should succeed with bad url');
  t.true(
    result.data?.discovery.data.some(
      (row) =>
        Array.isArray(row) && row[0] === 'gis.utah.gov' && row[2] === '❌',
    ),
    'Discovery data should indicate the url is bad',
  );
  t.true(
    result.data?.discovery.warnings.includes(
      'Failed to validate Product page URL due to a network error',
    ),
    'It catches unknown errors',
  );
});
