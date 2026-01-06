import test from 'ava';
import { WorkflowType } from '../src/models/types.js';
import { CommentGenerator } from '../src/services/comment-generator.js';
import { Logger } from '../src/services/logger.js';
import { TemplateDetector } from '../src/services/template-detector.js';
import { TemplateParser } from '../src/services/template-parser.js';

// Template Parser Tests
test('TemplateParser is instantiable', (t) => {
  const parser = new TemplateParser();
  t.truthy(parser);
  t.is(typeof parser.parse, 'function');
});

test('TemplateParser.parse handles string input', (t) => {
  const parser = new TemplateParser();
  const result = parser.parse('### Display Name\nUtah Test Data');
  t.is(result['display-name'], 'Utah Test Data');
});

test('TemplateParser.parse handles array input', (t) => {
  const parser = new TemplateParser();
  const result = parser.parse(['### Display Name', 'Utah Test Data']);
  t.is(result['display-name'], 'Utah Test Data');
});

// Template Detector Tests
test('TemplateDetector is instantiable', (t) => {
  const detector = new TemplateDetector();
  t.truthy(detector);
  t.is(typeof detector.detect, 'function');
});

test('TemplateDetector.detect identifies SGID deprecation from label', (t) => {
  const detector = new TemplateDetector();
  const result = detector.detect(['type: full deprecation'], 'Some issue body');
  t.is(result, WorkflowType.SGID_DEPRECATION);
});

test('TemplateDetector.detect identifies SGID deprecation from keywords', (t) => {
  const detector = new TemplateDetector();
  const result = detector.detect(
    ['type: full deprecation'],
    'Request to deprecate this layer',
  );
  t.is(result, WorkflowType.SGID_DEPRECATION);
});

test('TemplateDetector.detect returns null for unknown workflow', (t) => {
  const detector = new TemplateDetector();
  const result = detector.detect(['some-other-label'], 'Random issue body');
  t.is(result, null);
});

// Comment Generator Tests
test('CommentGenerator is instantiable', (t) => {
  const generator = new CommentGenerator();
  t.truthy(generator);
  t.is(typeof generator.generateValidationComment, 'function');
  t.is(typeof generator.generateStageComment, 'function');
  t.is(typeof generator.generateWorkflowInitComment, 'function');
});

test('CommentGenerator.generateValidationComment handles success', (t) => {
  const generator = new CommentGenerator();
  const result = generator.generateValidationComment({
    success: true,
    data: {
      displayName: 'Test',
      discovery: { data: [['header']], warnings: [] },
      arcgisOnline: { data: [], warnings: [] },
    },
  });

  t.true(result.includes('<!-- issue-ops-validation-comment -->'));
  t.true(result.includes('Punch that ticket'));
});

test('CommentGenerator.generateValidationComment handles errors', (t) => {
  const generator = new CommentGenerator();
  const result = generator.generateValidationComment({
    success: false,
    errors: {
      formErrors: ['Test error'],
      fieldErrors: {},
    },
  });

  t.true(result.includes('<!-- issue-ops-validation-comment -->'));
  t.true(result.includes('Whistle stop'));
  t.true(result.includes('Test error'));
});

test('CommentGenerator.generateStageComment creates stage comments', (t) => {
  const generator = new CommentGenerator();
  const result = generator.generateStageComment(
    'initial-review',
    'Review the request',
    '0 of 3 tasks complete',
  );

  t.true(result.includes('<!-- issue-ops-stage: initial-review -->'));
  t.true(result.includes('## 🚂 Stage: initial-review'));
  t.true(result.includes('0 of 3 tasks complete'));
});

test('CommentGenerator.generateWorkflowInitComment creates workflow comments', (t) => {
  const generator = new CommentGenerator();
  const result = generator.generateWorkflowInitComment('SGID Deprecation', [
    'review',
    'approval',
    'removal',
  ]);

  t.true(result.includes('<!-- issue-ops-workflow-init -->'));
  t.true(result.includes('SGID Deprecation Workflow Started'));
  t.true(result.includes('1. ▶️ review'));
  t.true(result.includes('2. ⏸️ approval'));
  t.true(result.includes('3. ⏸️ removal'));
});

// Logger Tests
test('Logger is instantiable', (t) => {
  const logger = new Logger();
  t.truthy(logger);
  t.is(typeof logger.info, 'function');
  t.is(typeof logger.warn, 'function');
  t.is(typeof logger.error, 'function');
  t.is(typeof logger.debug, 'function');
});

test('Logger methods are callable without errors', (t) => {
  const logger = new Logger();

  // These should not throw in test mode (silenced)
  t.notThrows(() => logger.info('test'));
  t.notThrows(() => logger.warn('test'));
  t.notThrows(() => logger.error('test'));
  t.notThrows(() => logger.debug('test'));
});
