#!/usr/bin/env node
import { Octokit } from '@octokit/rest';
import { postIssueComment, setLabels } from './github.js';
import { parseIssueTemplate } from './parsing.js';
import { isDiscoveryOk, validateAndTransform } from './schema.js';
import { log, logError } from './utils.js';

log('🚀 Starting issue processing...');

// Get environment variables from GitHub Actions
const issueNumber: string | undefined = process.env.ISSUE_NUMBER;
const issueTitle: string | undefined = process.env.ISSUE_TITLE;
const issueBody: string | undefined = process.env.ISSUE_BODY;
const githubToken: string | undefined = process.env.GITHUB_TOKEN;
const githubRepository: string | undefined = process.env.GITHUB_REPOSITORY;

const octokit = githubToken ? new Octokit({ auth: githubToken }) : null;

export async function run(): Promise<void> {
  try {
    log(`📋 Processing Issue #${issueNumber}`);
    log(`📝 Title: ${issueTitle}`);

    if (!issueNumber) {
      log('ℹ️ No issue data found - running in standalone mode');

      return;
    }

    if (!issueBody) {
      log('✅ Issue processing completed successfully!');

      return;
    }

    if (!octokit || !githubRepository) {
      log(
        '⚠️ GitHub token or repository not available - skipping GitHub operations',
      );

      return;
    }

    const data = parseIssueTemplate(issueBody.split('\n'));

    log('📊 Parsed issue data:', data);
    log('🔍 Starting validation of issue data...');

    const result = await validateAndTransform(data);

    await postIssueComment(result, {
      octokit,
      githubRepository,
      issueNumber,
    });

    await setLabels(issueNumber, result, {
      octokit,
      githubRepository,
    });

    if (isDiscoveryOk(result)) {
      // TODO: create soft delete tasks
    }

    log('✅ Issue processing completed successfully!');
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error';
    logError('❌ Issue processing failed:', errorMessage);

    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  // file is being run directly, not imported
  run().catch((error: Error) => {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error';
    logError('Failed to process issue:', errorMessage);

    process.exit(1);
  });
}
