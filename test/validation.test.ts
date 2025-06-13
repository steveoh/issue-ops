import test from 'ava';
import { validateIssueData } from '../src/main.js';

// Test data fixtures
const validCompleteData = {
  'display-name': 'Utah Avalanche Paths',
  'internal-sgid-table': 'geoscience.AvalanchePaths',
  'open-sgid-table': 'geoscience.avalanche_paths',
  'arcgis-online-url': 'https://www.arcgis.com/home/item.html?id=0df199cef1704e5287ae675ee3dbd3bd',
  'sgid-on-arcgis-url': 'https://opendata.gis.utah.gov/datasets/utah-avalanche-paths/about',
  'product-page-url-(gis.utah.gov)': 'https://gis.utah.gov/products/sgid/geoscience/avalanche-paths/',
  'sgid-index-id': '8081a767-ef27-4a17-acb1-88d90c5ed902',
  'archives-record-series': 'Some archive series'
};

const validMinimalData = {
  'display-name': 'Test Dataset',
  'internal-sgid-table': 'geoscience.AvalanchePaths'
};

const invalidUrlData = {
  'display-name': 'Test Dataset',
  'internal-sgid-table': 'test.table',
  'arcgis-online-url': 'not-a-valid-url',
  'sgid-on-arcgis-url': 'https://example.com',
  'product-page-url-(gis.utah.gov)': 'https://wrong-domain.com'
};

const invalidUuidData = {
  'display-name': 'Test Dataset',
  'internal-sgid-table': 'test.table',
  'sgid-index-id': 'not-a-valid-uuid'
};

const emptyDisplayNameData = {
  'display-name': '',
  'internal-sgid-table': 'test.table'
};

const nonGisUtahGovUrlData = {
  'display-name': 'Test Dataset',
  'internal-sgid-table': 'test.table',
  'product-page-url-(gis.utah.gov)': 'https://example.com/page'
};

test('validateIssueData validates successfully with complete valid data', async (t) => {
  const result = await validateIssueData(validCompleteData);

  t.true(result.success);
  t.is(result.errors.length, 0);
  t.truthy(result.data);
  t.is(result.data?.['display-name'], 'Utah Avalanche Paths');
});

test('validateIssueData validates successfully with minimal valid data', async (t) => {
  const result = await validateIssueData(validMinimalData);

  t.true(result.success);
  t.is(result.errors.length, 0);
  t.truthy(result.data);
  t.is(result.data?.['display-name'], 'Test Dataset');
  t.is(result.data?.['internal-sgid-table'], 'geoscience.AvalanchePaths');
});

test('validateIssueData fails with empty display name', async (t) => {
  const result = await validateIssueData(emptyDisplayNameData);

  t.false(result.success);
  t.true(result.errors.length > 0);
  t.true(result.errors.some(error =>
    error.field === 'display-name' &&
    error.message.includes('Display name is required')
  ));
});

test('validateIssueData fails with missing required fields', async (t) => {
  const missingRequiredData = {
    'display-name': 'Test Dataset',
    // Missing 'internal-sgid-table' which is required
    'open-sgid-table': 'optional.table'
  };

  const result = await validateIssueData(missingRequiredData);

  t.false(result.success);
  t.true(result.errors.length > 0);
  // Check for internal-sgid-table being required
  t.true(result.errors.some(error =>
    error.field === 'internal-sgid-table'
  ));
});

test('validateIssueData fails when only display-name is provided', async (t) => {
  const onlyDisplayNameData = {
    'display-name': 'Test Dataset'
    // Missing 'internal-sgid-table' which is required
  };

  const result = await validateIssueData(onlyDisplayNameData);

  t.false(result.success);
  t.true(result.errors.length > 0);
  t.true(result.errors.some(error =>
    error.field === 'internal-sgid-table'
  ));
});

test('validateIssueData fails with invalid URLs', async (t) => {
  const testCases = [
    {
      description: 'Invalid ArcGIS Online URL',
      data: { ...validMinimalData, 'arcgis-online-url': 'not-a-valid-url' },
      expectedField: 'arcgis-online-url',
      expectedMessage: 'Must be a valid URL',
    },
    {
      description: 'Invalid SGID on ArcGIS URL',
      data: { ...validMinimalData, 'sgid-on-arcgis-url': 'not-a-valid-url' },
      expectedField: 'sgid-on-arcgis-url',
      expectedMessage: 'Must be a valid URL',
    },
    {
      description: 'Invalid Product Page URL',
      data: { ...validMinimalData, 'product-page-url-(gis.utah.gov)': 'not-a-valid-url' },
      expectedField: 'product-page-url-(gis.utah.gov)',
      expectedMessage: 'Must be a valid URL',
    },
  ];

  await Promise.all(testCases.map(async (testCase) => {
    const result = await validateIssueData(testCase.data);

    t.false(result.success, testCase.description);
    t.true(result.errors.length > 0, testCase.description);
    t.true(result.errors.some(error =>
      error.field === testCase.expectedField &&
      error.message.includes(testCase.expectedMessage)
    ), testCase.description);
  }));
});

test('validateIssueData fails with invalid UUID', async (t) => {
  const result = await validateIssueData(invalidUuidData);

  t.false(result.success);
  t.true(result.errors.length > 0);
  t.true(result.errors.some(error =>
    error.field === 'sgid-index-id' &&
    error.message.includes('Must be a valid UUID')
  ));
});

test('validateIssueData fails when product page URL is not from gis.utah.gov', async (t) => {
  const testCases = [
    {
      description: 'Product page URL is not from gis.utah.gov',
      data: { ...validMinimalData, 'product-page-url-(gis.utah.gov)': 'https://example.com/page' },
      expectedField: 'product-page-url-(gis.utah.gov)',
      expectedMessage: 'Product page URL must be from gis.utah.gov, accessible, and without redirects',
    },
    {
      description: 'Product page URL is from a different subdomain',
      data: { ...validMinimalData, 'product-page-url-(gis.utah.gov)': 'https://subdomain.gis.utah.gov/page' },
      expectedField: 'product-page-url-(gis.utah.gov)',
      expectedMessage: 'Product page URL must be from gis.utah.gov, accessible, and without redirects',
    },
    {
      description: 'Product page contains a redirect',
      data: { ...validMinimalData, 'product-page-url-(gis.utah.gov)': 'https://gis.utah.gov/data/address-geocoders-locators/' },
      expectedField: 'product-page-url-(gis.utah.gov)',
      expectedMessage: 'Product page URL must be from gis.utah.gov, accessible, and without redirects',
    },
  ];

  await Promise.all(testCases.map(async (testCase) => {
    const result = await validateIssueData(testCase.data);

    t.false(result.success, testCase.description);
    t.true(result.errors.length > 0, testCase.description);
    t.true(result.errors.some(error =>
      error.field === testCase.expectedField &&
      error.message.includes(testCase.expectedMessage)
    ), testCase.description);
  }));
});

test('validateIssueData handles validation errors gracefully', async (t) => {
  // Create data with multiple validation errors
  const multipleErrorsData = {
    'display-name': '', // Empty string
    'internal-sgid-table': 'test.table',
    'arcgis-online-url': 'invalid-url',
    'sgid-index-id': 'not-a-uuid',
    'product-page-url-(gis.utah.gov)': 'https://wrong-domain.com'
  };

  const result = await validateIssueData(multipleErrorsData);

  t.false(result.success);
  t.true(result.errors.length >= 3); // Should have multiple errors

  // Verify all expected error fields are present
  const errorFields = result.errors.map(error => error.field);
  t.true(errorFields.includes('display-name'));
  t.true(errorFields.includes('arcgis-online-url'));
  t.true(errorFields.includes('sgid-index-id'));
});

test('validateIssueData returns proper error structure', async (t) => {
  const result = await validateIssueData(invalidUrlData);

  t.false(result.success);
  t.true(Array.isArray(result.errors));

  // Check that each error has the required structure
  result.errors.forEach(error => {
    t.true(typeof error.field === 'string');
    t.true(typeof error.message === 'string');
    t.true(error.field.length > 0);
    t.true(error.message.length > 0);
  });
});

test('validateIssueData accepts valid HTTP URLs', async (t) => {
  const httpUrlData = {
    'display-name': 'Test Dataset',
    'internal-sgid-table': 'test.table',
    'arcgis-online-url': 'http://example.com', // HTTP instead of HTTPS
  };

  const result = await validateIssueData(httpUrlData);

  // Should pass URL validation (HTTP is valid)
  t.true(result.success || result.errors.every(error =>
    !error.message.includes('Must be a valid URL')
  ));
});

test('validateIssueData handles undefined values for optional fields', async (t) => {
  const dataWithUndefined = {
    'display-name': 'Test Dataset',
    'internal-sgid-table': 'test.table',
    'arcgis-online-url': undefined,
  };

  const result = await validateIssueData(dataWithUndefined);

  // Should handle undefined gracefully for optional fields
  t.true(result.success);
  t.is(result.errors.length, 0);
});

test('validateIssueData fails with null values for string fields', async (t) => {
  const dataWithNull = {
    'display-name': 'Test Dataset',
    'internal-sgid-table': 'test.table',
    'open-sgid-table': null as any,
  };

  const result = await validateIssueData(dataWithNull);

  // Should fail because null is not a valid string value
  t.false(result.success);
  t.true(result.errors.length > 0);
  t.true(result.errors.some(error =>
    error.field === 'open-sgid-table' &&
    error.message.includes('expected string, received null')
  ));
});

test('validateIssueData ignores extra fields not in schema', async (t) => {
  const dataWithExtraFields = {
    'display-name': 'Test Dataset',
    'internal-sgid-table': 'test.table',
    'sgid-index-id': '8081a767-ef27-4a17-acb1-88d90c5ed902',
    'extra-field-1': 'Should be ignored',
    'another-field': 'Also ignored',
  };

  const result = await validateIssueData(dataWithExtraFields);

  t.true(result.success);
  t.is(result.errors.length, 0);
  // Extra fields should not cause validation to fail
});
