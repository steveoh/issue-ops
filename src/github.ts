import { Octokit } from '@octokit/rest';
import { markdownTable } from 'markdown-table';
import { isValidationOk, type ValidationResult } from './schema.js';
import { createDefaultLabels, log, logError } from './utils.js';

export function generateCommentBody(
  validationResult: ValidationResult,
): string {
  const validationMarker = `<!-- issue-ops-validation-comment -->`;

  // Determine the main status emoji
  const statusText = validationResult.success
    ? "Punch that ticket! This request's data is on track. 🎫 🚂🛤️"
    : "Whistle stop! ✋ This request's data isn't cleared for departure just yet.";
  const statusMessage = validationResult.success
    ? "The deprecation data has been successfully validated! Here's a summary of what I found."
    : 'There were validation errors found.';

  let commentBody = `${validationMarker}\n### ${statusText}\n\n${statusMessage}\n\n`;
  commentBody +=
    '**Please double check these results and edit your original issue until the results match your expectations and there are no errors.**\n\n';

  if (!isValidationOk(validationResult) && validationResult.errors) {
    commentBody += '### Input Validation Errors\n\n';

    // Top level errors
    if (validationResult.errors.formErrors.length > 0) {
      validationResult.errors.formErrors.forEach((error: string) => {
        commentBody += `- ${error}\n`;
      });

      commentBody += '\n';
    }

    // Handle field-specific errors
    Object.entries(validationResult.errors.fieldErrors ?? {}).forEach(
      ([field, messages]) => {
        if (messages && Array.isArray(messages) && messages.length > 0) {
          messages.forEach((message: string) => {
            commentBody += `- **${field}**: ${message}\n`;
          });
        }
      },
    );
  } else {
    // Add success validation table

    const data = validationResult.data;
    if (data) {
      // Generate the SGID products table
      if (data.discovery.data.length > 0) {
        commentBody += markdownTable(data?.discovery.data, {
          alignDelimiters: false,
        });
        commentBody += '\n\n';

        if (data?.discovery?.warnings?.length) {
          commentBody += '> [!WARNING]\n';

          data.discovery.warnings.forEach((warning) => {
            commentBody += `> - ${warning}\n`;
          });

          commentBody += '\n';
        }
      }

      // ArcGIS Online section
      if (data.arcgisOnline.data.length > 0) {
        commentBody += '### ArcGIS Online\n\n';

        // Generate the ArcGIS Online table
        commentBody += markdownTable(data.arcgisOnline.data, {
          alignDelimiters: false,
        });
        commentBody += '\n\n';

        if (data.arcgisOnline.warnings.length > 0) {
          commentBody += '. [!WARNING]\n';

          data.arcgisOnline.warnings.forEach((warning) => {
            commentBody += `> - ${warning}\n`;
          });
        }
      }
    }
  }

  // Add next steps for successful validation
  if (validationResult.success) {
    commentBody += '\n---\n\n';
    commentBody += '## ✅ Validation Complete\n\n';
    commentBody += 'All required information has been validated. The deprecation workflow will now begin.\n\n';
    commentBody += '**Next Steps:**\n';
    commentBody += '- Task issues will be created for the soft-delete phase\n';
    commentBody += '- Track progress via the workflow state comment below\n';
    commentBody += '- Complete tasks to advance through the workflow stages\n';
  }

  return commentBody;
}

export async function postIssueComment(
  validationResult: ValidationResult,
  options: {
    octokit: Octokit;
    githubRepository: string;
    issueNumber: string;
  },
): Promise<void> {
  const { octokit, githubRepository, issueNumber } = options;

  const [owner, repo] = githubRepository.split('/');
  if (!owner || !repo) {
    logError('❌ Invalid GitHub repository format:', githubRepository);
    // Don't throw, just log the error and return early
    return;
  }

  try {
    // Create a unique hidden marker for identifying our validation comments
    const botCommentMarker = `<!-- issue-ops-validation-comment -->`;

    // Check for existing validation comments
    const existingComments = await octokit.rest.issues.listComments({
      owner,
      repo,
      issue_number: parseInt(issueNumber, 10),
    });

    // Look for an existing validation comment from this script using the hidden marker
    // and ensure it was posted by the github-actions[bot] user
    const hasExistingComment = existingComments.data.find(
      (comment) =>
        comment.body &&
        comment.body.includes(botCommentMarker) &&
        comment.user &&
        (comment.user.login === 'github-actions[bot]' ||
          comment.user.type === 'Bot'),
    );

    const commentBody = generateCommentBody(validationResult);

    if (hasExistingComment) {
      // Update existing comment
      await octokit.rest.issues.updateComment({
        owner,
        repo,
        comment_id: hasExistingComment.id,
        body: commentBody,
      });
      log(`✅ Updated existing validation comment on issue #${issueNumber}`);
    } else {
      // Create new comment
      await octokit.rest.issues.createComment({
        owner,
        repo,
        issue_number: parseInt(issueNumber, 10),
        body: commentBody,
      });
      log(`✅ Posted new validation comment on issue #${issueNumber}`);
    }

    log(
      `✅ ${validationResult.success ? 'Success' : 'Failure'} feedback provided on issue #${issueNumber}`,
    );
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error';
    logError('❌ Failed to post issue comment:', errorMessage);
    // Don't re-throw, just log the error
  }
}

// Pure function for determining label changes - easy to test
export function determineLabelsToChange(
  validationResult: ValidationResult,
  existingLabels: string[],
): { toAdd: string[]; toRemove: string[] } {
  const toAdd: string[] = [];
  const toRemove: string[] = [];

  if (!validationResult.success) {
    // Validation failed - add the failing label if not already present
    if (!existingLabels.includes('status: validation failing')) {
      toAdd.push('status: validation failing');
    }
  } else {
    // Validation succeeded - remove the failing label if present
    if (existingLabels.includes('status: validation failing')) {
      toRemove.push('status: validation failing');
    }
  }

  if (
    (validationResult.data?.discovery.warnings?.length ?? 0) > 0 ||
    (validationResult.data?.arcgisOnline.warnings?.length ?? 0) > 0
  ) {
    if (!existingLabels.includes('status: discovery failing')) {
      toAdd.push('status: discovery failing');
    }
  } else {
    if (existingLabels.includes('status: discovery failing')) {
      toRemove.push('status: discovery failing');
    }
  }

  return { toAdd, toRemove };
}

// GitHub API wrapper functions - easier to test and mock
export async function addLabelsToIssue(
  octokit: Octokit,
  owner: string,
  repo: string,
  issueNumber: number,
  labels: string[],
): Promise<void> {
  if (labels.length === 0) return;

  await octokit.rest.issues.addLabels({
    owner,
    repo,
    issue_number: issueNumber,
    labels,
  });
}

export async function removeLabelFromIssue(
  octokit: Octokit,
  owner: string,
  repo: string,
  issueNumber: number,
  label: string,
): Promise<void> {
  await octokit.rest.issues.removeLabel({
    owner,
    repo,
    issue_number: issueNumber,
    name: label,
  });
}

export async function getExistingLabels(
  octokit: Octokit,
  owner: string,
  repo: string,
  issueNumber: number,
): Promise<string[]> {
  const labels = await octokit.rest.issues.listLabelsOnIssue({
    owner,
    repo,
    issue_number: issueNumber,
  });

  return labels.data.map((label) => label.name);
}

export async function setLabels(
  issue: string,
  result: ValidationResult,
  options: {
    octokit: Octokit;
    githubRepository: string;
    createDefaultLabels?: typeof createDefaultLabels;
  },
): Promise<{ added: string[]; removed: string[] }> {
  const {
    octokit,
    githubRepository,
    createDefaultLabels: createLabels = createDefaultLabels,
  } = options;

  const [owner, repo] = githubRepository.split('/');
  if (!owner || !repo) {
    logError('❌ Invalid GitHub repository format:', githubRepository);
    throw new Error(`Invalid GitHub repository format: ${githubRepository}`);
  }

  const issueNumber = parseInt(issue, 10);

  try {
    // Create default labels first
    await createLabels(octokit, githubRepository);

    // Get existing labels
    const existingLabels = await getExistingLabels(
      octokit,
      owner,
      repo,
      issueNumber,
    );

    // Determine what changes to make
    const { toAdd, toRemove } = determineLabelsToChange(result, existingLabels);

    // Execute label additions
    if (toAdd.length > 0) {
      await addLabelsToIssue(octokit, owner, repo, issueNumber, toAdd);
      toAdd.forEach((label) => {
        log(`✅ Added '${label}' label to issue #${issueNumber}`);
      });
    }

    // Execute label removals
    for (const label of toRemove) {
      await removeLabelFromIssue(octokit, owner, repo, issueNumber, label);
      log(`✅ Removed '${label}' label from issue #${issueNumber}`);
    }

    if (toAdd.length === 0 && toRemove.length === 0) {
      log(`ℹ️ No label changes needed for issue #${issueNumber}`);
    } else {
      log(`✅ Labels updated for issue #${issueNumber}`);
    }

    return { added: toAdd, removed: toRemove };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error';
    logError('❌ Failed to set labels on issue:', errorMessage);
    throw error;
  }
}

/**
 * Returns true if running in ANY CI environment (GitHub, GitLab, Travis, etc).
 * Most CI providers set the 'CI' variable to 'true'.
 */
export function isRunningInCi() {
  const ciValue = process.env.CI;
  // Check if defined and if it equals 'true' (case-insensitive)
  if (!ciValue) {
    return false;
  }

  const v = ciValue.toLowerCase();

  return v === 'true' || v === '1';
}
