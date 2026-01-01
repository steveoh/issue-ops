#!/usr/bin/env node
import { Octokit } from '@octokit/rest';
import { GitHubService } from './adapters/github-service.js';
import { postIssueComment, setLabels } from './github.js';
import { WorkflowStatus, WorkflowType, StageStatus } from './models/types.js';
import { parseIssueTemplate } from './parsing.js';
import { isDiscoveryOk, validateAndTransform } from './schema.js';
import { StateManager } from './services/state-manager.js';
import { TemplateDetector } from './services/template-detector.js';
import { Logger } from './services/logger.js';

const logger = new Logger();
logger.info('🚀 Starting issue processing...');

// Get environment variables from GitHub Actions
const issueNumber: string | undefined = process.env.ISSUE_NUMBER;
const issueTitle: string | undefined = process.env.ISSUE_TITLE;
const issueBody: string | undefined = process.env.ISSUE_BODY;
const githubToken: string | undefined = process.env.GITHUB_TOKEN;
const githubRepository: string | undefined = process.env.GITHUB_REPOSITORY;

const octokit = githubToken ? new Octokit({ auth: githubToken }) : null;

export async function run(): Promise<void> {
  try {
    logger.info(`📋 Processing Issue #${issueNumber}`);
    logger.info(`📝 Title: ${issueTitle}`);

    if (!issueNumber) {
      logger.info('ℹ️ No issue data found - running in standalone mode');
      return;
    }

    if (!issueBody) {
      logger.info('✅ Issue processing completed successfully!');
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

    // Initialize new services
    const github = new GitHubService(octokit, owner, repo);
    const stateManager = new StateManager(github);
    const templateDetector = new TemplateDetector();

    // Parse issue template
    const data = parseIssueTemplate(issueBody.split('\n'));
    logger.info('📊 Parsed issue data:', data);

    // Check if workflow is already initialized
    const existingState = await stateManager.loadState(parseInt(issueNumber));
    if (existingState) {
      logger.info('✅ Workflow already initialized, state loaded');
      logger.info(`Current stage: ${existingState.currentStage}`);
      logger.info(`Status: ${existingState.status}`);
      // TODO: Handle workflow progression in future (task completion, etc.)
      return;
    }

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
      logger.info('⚠️ Validation failed - skipping workflow initialization');
      return;
    }

    // Get issue labels to detect workflow type
    const labels = await github.getLabels(parseInt(issueNumber));
    const workflowType = templateDetector.detect(labels, issueBody);

    if (!workflowType) {
      logger.info('ℹ️ No workflow type detected - skipping workflow initialization');
      return;
    }

    logger.info(`🎯 Detected workflow type: ${workflowType}`);

    // Initialize workflow state
    const initialState = {
      version: '1.0.0',
      workflowType: workflowType as WorkflowType,
      issueNumber: parseInt(issueNumber),
      status: WorkflowStatus.ACTIVE,
      currentStage: 'initial',
      data: data,
      stages: {
        initial: {
          name: 'initial',
          status: StageStatus.COMPLETED,
          taskIssues: [],
          startedAt: new Date().toISOString(),
          completedAt: new Date().toISOString(),
          notes: 'Validation completed successfully. Workflow will be fully automated in future releases.',
        },
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await stateManager.saveState(initialState);
    logger.info('✅ Workflow state initialized!');

    if (isDiscoveryOk(result)) {
      // TODO: create soft delete tasks (Week 3)
      logger.info('📝 Ready to create tasks (coming in Week 3)');
    }

    logger.info('✅ Issue processing completed successfully!');
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
