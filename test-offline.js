#!/usr/bin/env node

/**
 * Offline test for workflow initialization
 * Tests parsing, validation, and workflow detection without GitHub API
 */

import { parseIssueTemplate } from './lib/src/parsing.js';
import { validateAndTransform } from './lib/src/schema.js';
import { TemplateDetector } from './lib/src/services/template-detector.js';
import { getWorkflow } from './lib/src/workflows/index.js';

// Mock issue body with deprecation template
const mockIssueBody = `### Display Name

Utah Test Layer

### Reasons for Deprecation

This is a test layer that is no longer needed. Data is outdated and superseded by newer dataset.

### Migration Guide

Use the new dataset at schema.new_table_name instead.

### Internal SGID Table

cadastre.TestLayer

### Open SGID Table

boundaries.test_layer

### ArcGIS Online Item Id

0df199cef1704e5287ae675ee3dbd3bd

### SGID on ArcGIS URL

https://opendata.gis.utah.gov/datasets/utah-test-layer/about

### Product Page URL

https://gis.utah.gov/products/sgid/boundaries/test-layer

### SGID Index Id

550e8400-e29b-41d4-a716-446655440000

### Source

- [x] Manual
- [ ] Farm from AGOL
- [ ] Other

### Historic Relevance

No

### Archives Record Series

_No response_`;

const mockLabels = ['deprecation', 'porter'];

console.log('🧪 Testing SGID Deprecation Workflow (Offline)');
console.log('='.repeat(50));
console.log('');

// Step 1: Parse template
console.log('📝 Step 1: Parsing issue template...');
const data = parseIssueTemplate(mockIssueBody.split('\n'));
console.log('✅ Parsed fields:');
console.log('   - Display Name:', data['display-name']);
console.log('   - Internal SGID Table:', data['internal-sgid-table']);
console.log('   - Open SGID Table:', data['open-sgid-table']);
console.log('   - AGOL Item ID:', data['arcgis-online-item-id']);
console.log('   - Product Page:', data['product-page-url']);
console.log('   - SGID Index ID:', data['sgid-index-id']);
console.log('');

// Step 2: Extract additional fields
console.log('📝 Step 2: Extracting additional fields...');
const extractAdditionalField = (fieldName) => {
  const lines = mockIssueBody.split('\n');
  const headerPattern = new RegExp(`^###\\s+${fieldName}`, 'i');
  for (let i = 0; i < lines.length; i++) {
    if (headerPattern.test(lines[i] || '')) {
      for (let j = i + 1; j < lines.length; j++) {
        const line = lines[j]?.trim() || '';
        if (line && !line.startsWith('_No response_') && !line.startsWith('###')) {
          return line;
        }
        if (line.startsWith('###')) break;
      }
    }
  }
  return '';
};

const deprecationReason = extractAdditionalField('Reasons for Deprecation');
const migrationGuide = extractAdditionalField('Migration Guide');
console.log('✅ Additional fields:');
console.log('   - Deprecation Reason:', deprecationReason.substring(0, 50) + '...');
console.log('   - Migration Guide:', migrationGuide);
console.log('');

// Step 3: Detect workflow type
console.log('🔍 Step 3: Detecting workflow type...');
const templateDetector = new TemplateDetector();
const workflowType = templateDetector.detect(mockLabels, mockIssueBody);
console.log(`✅ Detected workflow: ${workflowType}`);
console.log('');

// Step 4: Get workflow definition
console.log('📋 Step 4: Loading workflow definition...');
const workflowDef = getWorkflow(workflowType);
if (workflowDef) {
  console.log(`✅ Workflow loaded: ${workflowDef.name}`);
  console.log(`   - ${workflowDef.stages.length} stages defined`);
  console.log('');
  
  // Show stages
  console.log('📊 Workflow stages:');
  workflowDef.stages.forEach((stage, i) => {
    console.log(`   ${i + 1}. ${stage.name} (${stage.tasks.length} tasks)`);
  });
  console.log('');
  
  // Step 5: Show first stage tasks
  console.log('📝 Step 5: First stage tasks (after validation)...');
  const firstStage = workflowDef.stages.find(s => s.name === 'soft-delete');
  if (firstStage) {
    console.log(`Stage: ${firstStage.name}`);
    console.log(`Tasks: ${firstStage.tasks.length}`);
    console.log('');
    
    // Prepare variables for interpolation
    const variables = {
      layerName: data['display-name'],
      agolItemId: data['arcgis-online-item-id'] || '',
      sgidIndexId: data['sgid-index-id'] || '',
      openSgidTable: data['open-sgid-table'] || '',
      internalSgidTable: data['internal-sgid-table'] || '',
      productPageUrl: data['product-page-url'] || '',
      archivesRecordSeries: data['archives-record-series'] || '',
      migrationGuide: migrationGuide,
      issueNumber: '999',
      reason: deprecationReason,
    };
    
    // Show first 3 tasks with interpolation
    console.log('Sample tasks (first 3):');
    firstStage.tasks.slice(0, 3).forEach((task, i) => {
      let title = task.title;
      // Simple interpolation
      Object.keys(variables).forEach(key => {
        title = title.replace(new RegExp(`{{${key}}}`, 'g'), variables[key]);
      });
      console.log(`   ${i + 1}. ${title}`);
      if (task.assignee) {
        console.log(`      Assignee: @${task.assignee}`);
      }
    });
    console.log(`   ... and ${firstStage.tasks.length - 3} more tasks`);
  }
} else {
  console.log('❌ No workflow definition found');
}

console.log('');
console.log('✅ Offline test completed successfully!');
console.log('');
console.log('💡 To test with real GitHub API:');
console.log('   1. Set GITHUB_TOKEN environment variable');
console.log('   2. Run: ./test-workflow.sh');
