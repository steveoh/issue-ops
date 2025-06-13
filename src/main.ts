#!/usr/bin/env node

/**
 * Issue processing script for issue-ops repository
 * This script handles GitHub issue processing and automation
 */

import { z } from 'zod/v4';
import { Octokit } from '@octokit/rest';
import ky from 'ky';

// Define the allowed field names in one place
const ISSUE_DATA_FIELDS = [
  'display-name',
  'internal-sgid-table',
  'open-sgid-table',
  'arcgis-online-url',
  'sgid-on-arcgis-url',
  'product-page-url-(gis.utah.gov)',
  'sgid-index-id',
  'archives-record-series'
] as const;

const ISSUE_DATA_FIELDS_SET = new Set(ISSUE_DATA_FIELDS);

type IssueDataFields = typeof ISSUE_DATA_FIELDS[number];

interface IssueData extends Partial<Record<IssueDataFields, string>> {
  [key: string]: string | undefined;
}

// Validation result types
interface ValidationError {
  field: string;
  message: string;
}

interface ValidationResult {
  success: boolean;
  errors: ValidationError[];
  data?: z.infer<typeof IssueDataSchema>;
}

// Zod schema for issue data validation
const IssueDataSchema = z.object({
  'display-name': z.string().min(1, 'Display name is required'),
  'internal-sgid-table': z.string(),
  'open-sgid-table': z.string().optional(),
  'arcgis-online-url': z.url('Must be a valid URL').optional()
    .refine(async (url) => {
      if (!url) {
        return true; // Optional field
      }

      if (!url.includes('arcgis.com')) {
        return false;
      }

      try {
        const response = await ky.head(url, { redirect: 'error'});

        return response.ok;
      } catch {
        return false;
      }
    }, { message: 'ArcGIS Online URL must be accessible' }),
  'sgid-on-arcgis-url': z.url('Must be a valid URL').optional()
    .refine(async (url) => {
      if (!url) {
        return true; // Optional field
      }

      if (!url.includes('opendata.gis.utah.gov')) {
        return false;
      }

      try {
        const response = await ky.head(url, { redirect: 'error'});

        return response.ok;
      } catch {
        return false;
      }
    }, { message: 'SGID on ArcGIS URL must be accessible' }),
  'product-page-url-(gis.utah.gov)': z.url('Must be a valid URL').optional()
    .refine(async (url) => {
      if (!url) {
        return true; // Optional field
      }

      if (!url.includes('gis.utah.gov')) {
        return false;
      }

      try {
        const response = await ky.head(url, { redirect: 'error'});

        return response.ok;
      } catch {
        return false;
      }
    }, { message: 'Product page URL must be from gis.utah.gov, accessible, and without redirects' }),
    'sgid-index-id': z.uuidv4('Must be a valid UUID').optional()
    .refine(async (id) => {
      if (!id) {
        return true; // Optional field
      }
      // Example validation - check if ID exists in SGID index
      // Replace this with your actual database/API check
      return await validateSgidIndexId(id);
    }, { message: 'SGID Index ID must exist in the database' }),
    'archives-record-series': z.string().optional()
});

// Helper functions for validation
async function validateSgidIndexId(id: string) {
  // google sheets check
  return true;
}

// Function to post a comment to the GitHub issue
async function postIssueComment(validationResult: ValidationResult, issueData: IssueData): Promise<void> {
  if (!octokit || !githubRepository || !issueNumber) {
    console.log('ℹ️  Skipping GitHub comment - missing required GitHub context');

    return;
  }

  const [owner, repo] = githubRepository.split('/');
  if (!owner || !repo) {
    console.error('❌ Invalid GitHub repository format:', githubRepository);

    return;
  }

  try {
    // Create a unique hidden marker for identifying our validation comments
    const validationMarker = `<!-- issue-ops-validation-comment -->`;
    let commentBody: string;

    if (validationResult.success) {
      // Success comment with formatted data
      commentBody = `${validationMarker}
## ✅ Validation Successful

The issue data has been successfully validated! Here's a summary of the processed data:

${Object.entries(issueData)
  .filter(([_, value]) => value !== undefined)
  .map(([key, value]) => `- **${key}**: ${value}`)
  .join('\n')}

The data is ready for further processing.`;
    } else {
      // Error comment with details
      commentBody = `${validationMarker}
## ❌ Validation Failed

The following validation errors were found:

${validationResult.errors
  .map(error => `- **${error.field}**: ${error.message}`)
  .join('\n')}

Please review and correct the issue template data, then trigger the workflow again.`;
    }

    // Check for existing validation comments
    const existingComments = await octokit.rest.issues.listComments({
      owner,
      repo,
      issue_number: parseInt(issueNumber, 10)
    });

    // Look for an existing validation comment from this script using the hidden marker
    // and ensure it was posted by the github-actions[bot] user
    const validationComment = existingComments.data.find(comment =>
      comment.body &&
      comment.body.includes('<!-- issue-ops-validation-comment -->') &&
      comment.user &&
      (comment.user.login === 'github-actions[bot]' || comment.user.type === 'Bot')
    );

    if (validationComment) {
      // Update existing comment
      await octokit.rest.issues.updateComment({
        owner,
        repo,
        comment_id: validationComment.id,
        body: commentBody
      });
      console.log(`✅ Updated existing validation comment on issue #${issueNumber}`);
    } else {
      // Create new comment
      await octokit.rest.issues.createComment({
        owner,
        repo,
        issue_number: parseInt(issueNumber, 10),
        body: commentBody
      });
      console.log(`✅ Posted new validation comment on issue #${issueNumber}`);
    }

    console.log(`✅ ${validationResult.success ? 'Success' : 'Failure'} feedback provided on issue #${issueNumber}`);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('❌ Failed to post issue comment:', errorMessage);
  }
}

console.log('🚀 Starting issue processing...');

// Get environment variables from GitHub Actions
const issueNumber: string | undefined = process.env.ISSUE_NUMBER;
const issueTitle: string | undefined = process.env.ISSUE_TITLE;
const issueBody: string | undefined = process.env.ISSUE_BODY;
const githubToken: string | undefined = process.env.GITHUB_TOKEN;
const githubRepository: string | undefined = process.env.GITHUB_REPOSITORY;

// Initialize GitHub API client
const octokit = githubToken ? new Octokit({ auth: githubToken }) : null;

// Process issue data
export async function processIssue(): Promise<void> {
  try {
    console.log(`📋 Processing Issue #${issueNumber}`);
    console.log(`📝 Title: ${issueTitle}`);

    if (!issueNumber) {
      console.log('ℹ️  No issue data found - running in standalone mode');

      return;
    }

    if (!issueBody) {
      console.log('✅ Issue processing completed successfully!');

      return;
    }

    const data = parseIssueTemplate(issueBody.split('\n'));

    console.log('📊 Parsed issue data:', data);

    // Validate the data using Zod schema
    const validationResult = await validateIssueData(data);

    // Post a comment on the issue with validation results
    await postIssueComment(validationResult, data);

    if (!validationResult.success) {
      console.error('❌ Validation failed:');
      validationResult.errors.forEach(error => {
        console.error(`  - ${error.field}: ${error.message}`);
      });

      process.exit(1);
    }

    console.log('✅ Issue data validation passed!');
    console.log('✅ Issue processing completed successfully!');
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('❌ Issue processing failed:', errorMessage);

    process.exit(1);
  }
}

// Validate issue data using Zod schema
export async function validateIssueData(data: IssueData): Promise<ValidationResult> {
  try {
    console.log('🔍 Starting validation of issue data...');

    const result = await IssueDataSchema.safeParseAsync(data);

    if (result.success) {
      return {
        success: true,
        errors: [],
        data: result.data
      };
    } else {
      const errors: ValidationError[] = result.error.issues.map(err => ({
        field: err.path.join('.'),
        message: err.message
      }));

      return {
        success: false,
        errors
      };
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown validation error';

    return {
      success: false,
      errors: [{
        field: 'validation',
        message: `Validation failed: ${errorMessage}`
      }]
    };
  }
}

export function parseIssueTemplate(lines: string[]): IssueData {
  const data: IssueData = {};
  let currentField: string | null = null;

  for (const line of lines) {
    // Look for field headers (usually in the format "### Field Name")
    const headerMatch = line.match(/^###\s+(.+)$/);
    if (headerMatch) {
      currentField = headerMatch[1]!.toLowerCase().replace(/\s+/g, '-');

      continue;
    }

    // Look for filled-in values (non-empty lines that aren't placeholders)
    if (currentField &&
        ISSUE_DATA_FIELDS_SET.has(currentField as any) &&
        line.trim() &&
        !line.startsWith('_No response_') &&
        !line.startsWith('<!--') &&
        !line.includes('placeholder')) {
      data[currentField] = line.trim();
      currentField = null;
    }
  }

  return data;
}

// Only run if this is the main module
if (import.meta.url === `file://${process.argv[1]}`) {
  processIssue().catch((error: Error) => {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Failed to process issue:', errorMessage);
    process.exit(1);
  });
}
