import test from 'ava';
import {
  isDiscoveryOk,
  isValidationOk,
  type ValidationResult,
} from '../src/schema.js';

test('schema isValidationOk returns true for valid data', (t) => {
  const data = {
    success: true,
  } satisfies ValidationResult;

  t.true(isValidationOk(data));
});

test('schema isValidationOk returns false when success is false', (t) => {
  const data = {
    success: false,
  } as ValidationResult;

  t.false(isValidationOk(data));
});

test('schema isValidationOk returns false when errors has data', (t) => {
  const data = {
    success: true,
    errors: {
      fieldErrors: {},
      formErrors: ['Some form error'],
    },
  } as ValidationResult;

  t.false(isValidationOk(data));
});

test('schema isDiscoveryOk returns true when data has no warnings', (t) => {
  const data = {
    success: true,
    data: {
      displayName: 'Test Dataset',
      discovery: {
        data: [],
        warnings: [],
      },
      arcgisOnline: {
        data: [],
        warnings: [],
      },
    },
  } as ValidationResult;

  t.true(isDiscoveryOk(data));
});

test('schema isDiscoveryOk returns false when discovery has warnings', (t) => {
  const data = {
    success: true,
    data: {
      displayName: 'Test Dataset',
      discovery: {
        data: [],
        warnings: ['Some discovery warning'],
      },
      arcgisOnline: {
        data: [],
        warnings: [],
      },
    },
  } as ValidationResult;

  t.false(isDiscoveryOk(data));
});

test('schema isDiscoveryOk returns false when agol has warnings', (t) => {
  const data = {
    success: true,
    data: {
      displayName: 'Test Dataset',
      discovery: {
        data: [],
        warnings: [],
      },
      arcgisOnline: {
        data: [],
        warnings: ['Some discovery warning'],
      },
    },
  } as ValidationResult;

  t.false(isDiscoveryOk(data));
});
