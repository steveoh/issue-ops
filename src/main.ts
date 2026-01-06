#!/usr/bin/env node

// Load environment variables from .env file for local development
// Skip in GitHub Actions (which provides env vars directly)
if (!isRunningInCi()) {
  try {
    // @ts-ignore - dotenv is a dev dependency, only used locally
    await import('dotenv/config');
  } catch {
    // dotenv not installed or no .env file - that's OK
  }
}

import { Octokit } from '@octokit/rest';
import { GitHubService } from './adapters/github-service.js';
import { isRunningInCi, postIssueComment, setLabels } from './github.js';
import { TransitionEvent } from './models/types.js';
import { parseIssueTemplate } from './parsing.js';
import { validateAndTransform } from './schema.js';
import { Logger } from './services/logger.js';
import { StateManager } from './services/state-manager.js';
import { TaskManager } from './services/task-manager.js';
import { TemplateDetector } from './services/template-detector.js';
import { WorkflowOrchestrator } from './services/workflow-orchestrator.js';
import { getWorkflow } from './workflows/index.js';

const logger = new Logger();
logger.info('🚀 Starting issue processing...');

// Get environment variables from GitHub Actions
const issueNumber: string | undefined = process.env.ISSUE_NUMBER;
const issueTitle: string | undefined = process.env.ISSUE_TITLE;
const issueBody: string | undefined = process.env.ISSUE_BODY;
const issueAction: string | undefined = process.env.ISSUE_ACTION; // opened, edited, closed
const githubToken: string | undefined = process.env.GITHUB_TOKEN;
const githubRepository: string | undefined = process.env.GITHUB_REPOSITORY;

const octokit = githubToken ? new Octokit({ auth: githubToken }) : null;

export async function run(): Promise<void> {
  try {
    logger.info(`📋 Processing Issue #${issueNumber}`);
    logger.info(`📝 Title: ${issueTitle}`);
    logger.info(`🎬 Action: ${issueAction || 'opened'}`);

    if (!issueNumber) {
      logger.info('ℹ️ No issue data found - running in standalone mode');
      return;
    }

    if (!issueBody) {
      logger.info('✅ Issue has no body - skipping');
      return;
    }

    if (!octokit || !githubRepository) {
      logger.warn(
        '⚠️ GitHub token or repository not available - skipping GitHub operations',
      );
      return;
    }

    const [owner, repo] = githubRepository.split('/');
    if (!owner || !repo) {
      logger.error('❌ Invalid GitHub repository format:', githubRepository);
      return;
    }

    // Initialize services
    const github = new GitHubService(octokit, owner, repo);
    const stateManager = new StateManager(github);
    const taskManager = new TaskManager(github, stateManager);
    const orchestrator = new WorkflowOrchestrator(stateManager, github);
    const templateDetector = new TemplateDetector();

    const issueNum = parseInt(issueNumber);

    // Check if workflow is already initialized
    const existingState = await stateManager.loadState(issueNum);

    if (existingState) {
      logger.info('✅ Workflow already initialized');
      logger.info(`Current stage: ${existingState.currentStage}`);
      logger.info(`Status: ${existingState.status}`);

      // TODO: Handle task completion events (check if this is a task issue being closed)
      // TODO: Handle grace period expiration checks
      // For now, just log and return
      return;
    }

    // New issue - initialize workflow
    logger.info('🆕 New issue - initializing workflow');

    // Parse issue template
    const data = parseIssueTemplate(issueBody.split('\n'));
    logger.info('📊 Parsed issue data:', data);

    // Extract additional fields not in schema (for workflow tasks)
    const extractAdditionalField = (fieldName: string): string => {
      const lines = issueBody.split('\n');
      const headerPattern = new RegExp(`^###\\s+${fieldName}`, 'i');
      for (let i = 0; i < lines.length; i++) {
        if (headerPattern.test(lines[i] || '')) {
          // Get next non-empty line after header
          for (let j = i + 1; j < lines.length; j++) {
            const line = lines[j]?.trim() || '';
            if (
              line &&
              !line.startsWith('_No response_') &&
              !line.startsWith('###')
            ) {
              return line;
            }
            // Stop if we hit another header
            if (line.startsWith('###')) break;
          }
        }
      }
      return '';
    };

    const deprecationReason = extractAdditionalField('Reasons for Deprecation');
    const migrationGuide = extractAdditionalField('Migration Guide');

    // Validate the issue data
    logger.info('🔍 Starting validation of issue data...');
    const result = await validateAndTransform(data);

    // Post validation comment (existing behavior)
    await postIssueComment(result, {
      octokit,
      githubRepository,
      issueNumber,
    });

    // Update labels (existing behavior)
    await setLabels(issueNumber, result, {
      octokit,
      githubRepository,
    });

    // Only initialize workflow if validation succeeds
    if (!result.success) {
      logger.info(
        '⚠️ Validation failed - workflow will not start until issues are fixed',
      );
      logger.info('User can edit the issue to fix validation errors');
      return;
    }

    logger.info('✅ Validation passed!');

    // Get issue labels to detect workflow type
    const labels = await github.getLabels(issueNum);
    const workflowType = templateDetector.detect(labels, issueBody);

    if (!workflowType) {
      logger.info(
        'ℹ️ No workflow type detected - this may not be a workflow issue',
      );
      logger.info('Validation complete, no further automation needed');
      return;
    }

    logger.info(`🎯 Detected workflow type: ${workflowType}`);

    // Get workflow definition
    const workflowDef = getWorkflow(workflowType);
    if (!workflowDef) {
      logger.error(
        `❌ Workflow definition not found for type: ${workflowType}`,
      );
      logger.error('This workflow type may not be implemented yet');
      return;
    }

    logger.info(`📋 Using workflow: ${workflowDef.name}`);

    // Initialize workflow
    logger.info('🎬 Initializing workflow...');
    const state = await orchestrator.initializeWorkflow(
      issueNum,
      workflowDef,
      data as Record<string, unknown>,
    );

    logger.info(`✅ Workflow initialized in stage: ${state.currentStage}`);

    // Trigger validation passed event to move to first real stage
    logger.info('🔄 Triggering validation passed transition...');
    const transitionedState = await orchestrator.transitionStage(
      issueNum,
      TransitionEvent.VALIDATION_PASSED,
      workflowDef,
    );

    if (transitionedState) {
      logger.info(
        `✅ Transitioned to stage: ${transitionedState.currentStage}`,
      );

      // Create tasks for the new stage
      const currentStage = workflowDef.stages.find(
        (s) => s.name === transitionedState.currentStage,
      );

      if (currentStage && currentStage.tasks.length > 0) {
        logger.info(`📝 Creating ${currentStage.tasks.length} task(s)...`);

        // Prepare variables for task templates
        const variables: Record<string, string> = {
          layerName: String(data['display-name'] || 'Unknown'),
          agolItemId: String(data['arcgis-online-item-id'] || ''),
          sgidIndexId: String(data['sgid-index-id'] || ''),
          openSgidTable: String(data['open-sgid-table'] || ''),
          internalSgidTable: String(data['internal-sgid-table'] || ''),
          productPageUrl: String(data['product-page-url'] || ''),
          archivesRecordSeries: String(data['archives-record-series'] || ''),
          migrationGuide: migrationGuide,
          issueNumber: issueNumber,
          reason: deprecationReason,
          repo: githubRepository, // e.g., "steveoh/issue-ops"
        };

        const tasks = await taskManager.createTaskIssues(
          issueNum,
          currentStage.name,
          currentStage.tasks,
          undefined, // Let assignees from templates take precedence
          variables,
        );

        logger.info(`✅ Created ${tasks.length} task issue(s)`);
      } else {
        logger.info('ℹ️ No tasks to create for this stage');
      }
    }

    logger.info('🎉 Issue processing completed successfully!');
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error';
    logger.error('❌ Issue processing failed:', errorMessage);
    if (error instanceof Error && error.stack) {
      logger.error(error.stack);
    }
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  // file is being run directly, not imported
  run().catch((error: Error) => {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error';
    logger.error('Failed to process issue:', errorMessage);
    process.exit(1);
  });
}
