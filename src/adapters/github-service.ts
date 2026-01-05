import type { Octokit } from '@octokit/rest';
import { GitHubError } from '../models/errors.js';

/**
 * Request error from Octokit (duck-typed)
 */
interface RequestError extends Error {
  status?: number;
  response?: {
    status: number;
  };
}

/**
 * Parameters for creating an issue
 */
export interface CreateIssueParams {
  title: string;
  body: string;
  labels?: string[];
  assignees?: string[];
}

/**
 * GitHub service for issue and comment operations
 * Provides access to GitHub REST API with retry logic and error handling
 */
export class GitHubService {
  constructor(
    private readonly octokit: Octokit,
    public readonly owner: string,
    public readonly repo: string,
  ) {}

  /**
   * Retry a GitHub API call with exponential backoff
   * Handles rate limiting and transient errors
   */
  private async retryWithBackoff<T>(
    operation: () => Promise<T>,
    maxRetries = 3,
  ): Promise<T> {
    let lastError: Error | undefined;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error as Error;

        // Check if it's a rate limit or server error
        const isRetryable =
          error &&
          typeof error === 'object' &&
          'status' in error &&
          (error.status === 429 || // Rate limit
            error.status === 500 || // Server error
            error.status === 502 || // Bad gateway
            error.status === 503 || // Service unavailable
            error.status === 504); // Gateway timeout

        if (!isRetryable || attempt === maxRetries) {
          throw error;
        }

        // Calculate backoff: 1s, 2s, 4s
        const backoffMs = Math.min(1000 * 2 ** attempt, 4000);
        await new Promise((resolve) => setTimeout(resolve, backoffMs));
      }
    }

    throw lastError;
  }

  /**
   * Create a comment on an issue
   * @param issueNumber - Issue number
   * @param body - Comment body in Markdown
   * @returns Comment ID
   * @throws GitHubError if comment creation fails
   */
  async createComment(issueNumber: number, body: string): Promise<number> {
    try {
      const response = await this.retryWithBackoff(() =>
        this.octokit.rest.issues.createComment({
          owner: this.owner,
          repo: this.repo,
          issue_number: issueNumber,
          body,
        }),
      );

      return response.data.id;
    } catch (error) {
      const requestError = error as RequestError;
      throw new GitHubError(
        `Failed to create comment: ${requestError.message}`,
        'createComment',
        {
          issueNumber,
          status: requestError.status,
        },
      );
    }
  }

  /**
   * Update an existing comment
   * @param commentId - Comment ID
   * @param body - New comment body in Markdown
   * @throws GitHubError if update fails
   */
  async updateComment(commentId: number, body: string): Promise<void> {
    try {
      await this.retryWithBackoff(() =>
        this.octokit.rest.issues.updateComment({
          owner: this.owner,
          repo: this.repo,
          comment_id: commentId,
          body,
        }),
      );
    } catch (error) {
      const requestError = error as RequestError;
      throw new GitHubError(
        `Failed to update comment: ${requestError.message}`,
        'updateComment',
        {
          commentId,
          status: requestError.status,
        },
      );
    }
  }

  /**
   * Get a comment by ID
   * @param commentId - Comment ID
   * @returns Comment body
   * @throws GitHubError if comment not found
   */
  async getComment(commentId: number): Promise<string> {
    try {
      const response = await this.retryWithBackoff(() =>
        this.octokit.rest.issues.getComment({
          owner: this.owner,
          repo: this.repo,
          comment_id: commentId,
        }),
      );

      return response.data.body ?? '';
    } catch (error) {
      const requestError = error as RequestError;
      throw new GitHubError(
        `Failed to get comment: ${requestError.message}`,
        'getComment',
        {
          commentId,
          status: requestError.status,
        },
      );
    }
  }

  /**
   * Find a bot comment by HTML marker
   * @param issueNumber - Issue number
   * @param marker - HTML comment marker (e.g., "<!-- issue-ops-state -->")
   * @returns Comment ID if found, null otherwise
   * @throws GitHubError if listing comments fails
   */
  async findBotComment(
    issueNumber: number,
    marker: string,
  ): Promise<number | null> {
    try {
      const response = await this.retryWithBackoff(() =>
        this.octokit.rest.issues.listComments({
          owner: this.owner,
          repo: this.repo,
          issue_number: issueNumber,
        }),
      );

      const comment = response.data.find(
        (comment) =>
          comment.body &&
          comment.body.includes(marker) &&
          comment.user &&
          (comment.user.login === 'github-actions[bot]' ||
            comment.user.type === 'Bot'),
      );

      return comment?.id ?? null;
    } catch (error) {
      const requestError = error as RequestError;
      throw new GitHubError(
        `Failed to list comments: ${requestError.message}`,
        'findBotComment',
        {
          issueNumber,
          marker,
          status: requestError.status,
        },
      );
    }
  }

  /**
   * Add labels to an issue
   * @param issueNumber - Issue number
   * @param labels - Labels to add
   * @throws GitHubError if adding labels fails
   */
  async addLabels(issueNumber: number, labels: string[]): Promise<void> {
    if (labels.length === 0) return;

    try {
      await this.retryWithBackoff(() =>
        this.octokit.rest.issues.addLabels({
          owner: this.owner,
          repo: this.repo,
          issue_number: issueNumber,
          labels,
        }),
      );
    } catch (error) {
      const requestError = error as RequestError;
      throw new GitHubError(
        `Failed to add labels: ${requestError.message}`,
        'addLabels',
        {
          issueNumber,
          labels,
          status: requestError.status,
        },
      );
    }
  }

  /**
   * Remove a label from an issue
   * @param issueNumber - Issue number
   * @param label - Label to remove
   * @throws GitHubError if removing label fails
   */
  async removeLabel(issueNumber: number, label: string): Promise<void> {
    try {
      await this.retryWithBackoff(() =>
        this.octokit.rest.issues.removeLabel({
          owner: this.owner,
          repo: this.repo,
          issue_number: issueNumber,
          name: label,
        }),
      );
    } catch (error) {
      const requestError = error as RequestError;
      // Ignore 404 - label might not exist
      if (requestError.status === 404) {
        return;
      }

      throw new GitHubError(
        `Failed to remove label: ${requestError.message}`,
        'removeLabel',
        {
          issueNumber,
          label,
          status: requestError.status,
        },
      );
    }
  }

  /**
   * Get all labels on an issue
   * @param issueNumber - Issue number
   * @returns Array of label names
   * @throws GitHubError if listing labels fails
   */
  async getLabels(issueNumber: number): Promise<string[]> {
    try {
      const response = await this.retryWithBackoff(() =>
        this.octokit.rest.issues.listLabelsOnIssue({
          owner: this.owner,
          repo: this.repo,
          issue_number: issueNumber,
        }),
      );

      return response.data.map((label) => label.name);
    } catch (error) {
      const requestError = error as RequestError;
      throw new GitHubError(
        `Failed to list labels: ${requestError.message}`,
        'getLabels',
        {
          issueNumber,
          status: requestError.status,
        },
      );
    }
  }

  /**
   * Create a new issue
   * @param params - Issue parameters
   * @returns Issue number
   * @throws GitHubError if issue creation fails
   */
  async createIssue(params: CreateIssueParams): Promise<number> {
    try {
      const response = await this.retryWithBackoff(() =>
        this.octokit.rest.issues.create({
          owner: this.owner,
          repo: this.repo,
          title: params.title,
          body: params.body,
          labels: params.labels,
          assignees: params.assignees,
        }),
      );

      return response.data.number;
    } catch (error) {
      const requestError = error as RequestError;
      throw new GitHubError(
        `Failed to create issue: ${requestError.message}`,
        'createIssue',
        {
          title: params.title,
          status: requestError.status,
        },
      );
    }
  }

  /**
   * Close an issue
   * @param issueNumber - Issue number
   * @throws GitHubError if closing issue fails
   */
  async closeIssue(issueNumber: number): Promise<void> {
    try {
      await this.retryWithBackoff(() =>
        this.octokit.rest.issues.update({
          owner: this.owner,
          repo: this.repo,
          issue_number: issueNumber,
          state: 'closed',
        }),
      );
    } catch (error) {
      const requestError = error as RequestError;
      throw new GitHubError(
        `Failed to close issue: ${requestError.message}`,
        'closeIssue',
        {
          issueNumber,
          status: requestError.status,
        },
      );
    }
  }

  /**
   * Search for issues using GitHub search syntax
   * @param query - Search query (will be scoped to this repo)
   * @returns Array of issue numbers
   * @throws GitHubError if search fails
   */
  async searchIssues(query: string): Promise<number[]> {
    try {
      const fullQuery = `${query} repo:${this.owner}/${this.repo}`;
      const response = await this.retryWithBackoff(() =>
        this.octokit.rest.search.issuesAndPullRequests({
          q: fullQuery,
        }),
      );

      return response.data.items.map((item) => item.number);
    } catch (error) {
      const requestError = error as RequestError;
      throw new GitHubError(
        `Failed to search issues: ${requestError.message}`,
        'searchIssues',
        {
          query,
          status: requestError.status,
        },
      );
    }
  }

  /**
   * Create repository labels if they don't exist
   * @param labels - Labels to create
   * @throws GitHubError if label creation fails
   */
  async createLabels(
    labels: Array<{ name: string; color: string; description: string }>,
  ): Promise<void> {
    try {
      const existingLabels = await this.retryWithBackoff(() =>
        this.octokit.rest.issues.listLabelsForRepo({
          owner: this.owner,
          repo: this.repo,
        }),
      );

      const existingLabelNames = new Set(
        existingLabels.data.map((label) => label.name),
      );

      const labelsToCreate = labels.filter(
        (label) => !existingLabelNames.has(label.name),
      );

      for (const label of labelsToCreate) {
        try {
          await this.retryWithBackoff(() =>
            this.octokit.rest.issues.createLabel({
              owner: this.owner,
              repo: this.repo,
              name: label.name,
              color: label.color,
              description: label.description,
            }),
          );
        } catch (error) {
          // Ignore if label already exists
          const requestError = error as RequestError;
          if (
            !requestError.message.includes('already_exists') &&
            requestError.status !== 422
          ) {
            throw error;
          }
        }
      }
    } catch (error) {
      const requestError = error as RequestError;
      throw new GitHubError(
        `Failed to create labels: ${requestError.message}`,
        'createLabels',
        {
          labelCount: labels.length,
          status: requestError.status,
        },
      );
    }
  }
}
