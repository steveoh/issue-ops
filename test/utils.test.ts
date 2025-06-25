import test from 'ava';
import { log, logError, warn } from '../src/utils.js';

// Global state tracking for mocked console methods
let logCalls: unknown[][] = [];
let warnCalls: unknown[][] = [];
let errorCalls: unknown[][] = [];

// Helper function to set NODE_ENV
function setNodeEnv(value: string | undefined) {
  process.env.NODE_ENV = value;
}

// Setup console mocks before each test
test.beforeEach(() => {
  logCalls = [];
  warnCalls = [];
  errorCalls = [];

  console.log = (...args: unknown[]) => logCalls.push(args);
  console.warn = (...args: unknown[]) => warnCalls.push(args);
  console.error = (...args: unknown[]) => errorCalls.push(args);
});

test.serial('log function calls console.log when NODE_ENV is not test', (t) => {
  setNodeEnv('development');

  log('Test message', 'with', 'multiple', 'args');

  t.is(logCalls.length, 1);
  t.deepEqual(logCalls[0], ['Test message', 'with', 'multiple', 'args']);
});

test.serial(
  'log function does not call console.log when NODE_ENV is test',
  (t) => {
    setNodeEnv('test');

    log('Test message', 'should not appear');

    t.is(logCalls.length, 0);
  },
);

test.serial('log function works with no arguments', (t) => {
  setNodeEnv('production');

  log();

  t.is(logCalls.length, 1);
  t.deepEqual(logCalls[0], []);
});

test.serial('log function works with objects and complex data', (t) => {
  setNodeEnv('development');

  const testObj = { key: 'value', nested: { data: 123 } };
  log('Object:', testObj, [1, 2, 3]);

  t.is(logCalls.length, 1);
  t.deepEqual(logCalls[0], ['Object:', testObj, [1, 2, 3]]);
});

// Tests for warn function
test.serial(
  'warn function calls console.warn when NODE_ENV is not test',
  (t) => {
    setNodeEnv('development');

    warn('Warning message', 'with details');

    t.is(warnCalls.length, 1);
    t.deepEqual(warnCalls[0], ['Warning message', 'with details']);
  },
);

test.serial(
  'warn function does not call console.warn when NODE_ENV is test',
  (t) => {
    setNodeEnv('test');

    warn('Warning message', 'should not appear');

    t.is(warnCalls.length, 0);
  },
);

test.serial('warn function works with no arguments', (t) => {
  setNodeEnv('staging');

  warn();

  t.is(warnCalls.length, 1);
  t.deepEqual(warnCalls[0], []);
});

// Tests for logError function
test.serial(
  'logError function calls console.error when NODE_ENV is not test',
  (t) => {
    setNodeEnv('production');

    logError('Error message', 'with context');

    t.is(errorCalls.length, 1);
    t.deepEqual(errorCalls[0], ['Error message', 'with context']);
  },
);

test.serial(
  'logError function does not call console.error when NODE_ENV is test',
  (t) => {
    setNodeEnv('test');

    logError('Error message', 'should not appear');

    t.is(errorCalls.length, 0);
  },
);

test.serial('logError function works with Error objects', (t) => {
  setNodeEnv('development');

  const error = new Error('Test error');
  logError('Error occurred:', error);

  t.is(errorCalls.length, 1);
  t.deepEqual(errorCalls[0], ['Error occurred:', error]);
});

// Integration tests for logging with different NODE_ENV values
test.serial('all logging functions respect NODE_ENV=test', (t) => {
  setNodeEnv('test');

  log('Should not appear');
  warn('Should not appear');
  logError('Should not appear');

  t.is(logCalls.length, 0);
  t.is(warnCalls.length, 0);
  t.is(errorCalls.length, 0);
});

test.serial('all logging functions work when NODE_ENV is undefined', (t) => {
  setNodeEnv(undefined);

  log('Should appear');
  warn('Should appear');
  logError('Should appear');

  t.is(logCalls.length, 1);
  t.is(warnCalls.length, 1);
  t.is(errorCalls.length, 1);
});

test.serial('all logging functions work with NODE_ENV=production', (t) => {
  setNodeEnv('production');

  log('Production log');
  warn('Production warning');
  logError('Production error');

  t.is(logCalls.length, 1);
  t.is(warnCalls.length, 1);
  t.is(errorCalls.length, 1);

  t.deepEqual(logCalls[0], ['Production log']);
  t.deepEqual(warnCalls[0], ['Production warning']);
  t.deepEqual(errorCalls[0], ['Production error']);
});
