import type { GitHubService } from '../adapters/github-service.js';
import { InvalidStateError } from '../models/errors.js';
import type { WorkflowState } from '../models/workflow-state.js';
import { Logger } from './logger.js';

/**
 * State manager service
 * Persists workflow state in GitHub issue comments as JSON wrapped in HTML comments
 * This allows for stateless GitHub Actions execution
 */
export class StateManager {
  private readonly stateMarker = '<!-- issue-ops-state';
  private readonly logger = new Logger();

  constructor(private readonly github: GitHubService) {}

  /**
   * Load workflow state from issue comments
   * @param issueNumber - Issue number to load state from
   * @returns Workflow state if found, null otherwise
   * @throws InvalidStateError if state is corrupted
   */
  async loadState(issueNumber: number): Promise<WorkflowState | null> {
    this.logger.debug(`Loading state for issue #${issueNumber}`);

    // Get issue body
    const issueBody = await this.github.getIssueBody(issueNumber);

    // Check if state marker exists
    if (!issueBody.includes(this.stateMarker)) {
      this.logger.debug(`No state found for issue #${issueNumber}`);
      return null;
    }

    return this.parseStateFromComment(issueBody);
  }

  /**
   * Save workflow state to issue body
   * Embeds state in HTML comment at the top of the issue
   * @param state - Workflow state to save
   * @throws InvalidStateError if state is invalid
   */
  async saveState(state: WorkflowState): Promise<void> {
    this.logger.debug(
      `Saving state for issue #${state.issueNumber}, status: ${state.status}`,
    );

    this.validateState(state);

    // Update timestamp
    state.updatedAt = new Date().toISOString();

    // Get the current issue body
    const existingBody = await this.github.getIssueBody(state.issueNumber);
    
    // Remove any existing state and add new state
    const stateJson = JSON.stringify(state, null, 2);
    const stateComment = `${this.stateMarker}\n${stateJson}\n-->`;
    
    // Remove old state if present
    const withoutState = existingBody.replace(
      /<!-- issue-ops-state\s*\n[\s\S]*?\n-->/,
      '',
    );
    
    // Add state at the very beginning of the issue body
    const updatedBody = `${stateComment}\n\n${withoutState}`;

    await this.github.updateIssueBody(state.issueNumber, updatedBody);
    this.logger.debug(
      `Updated state in issue body for issue #${state.issueNumber}`,
    );
  }

  /**
   * Parse workflow state from comment body
   * Extracts JSON from HTML comment marker
   * @param commentBody - Comment body containing state
   * @returns Parsed workflow state
   * @throws InvalidStateError if JSON is invalid
   */
  private parseStateFromComment(commentBody: string): WorkflowState {
    // Extract JSON from HTML comment: <!-- issue-ops-state\n{...}\n-->\n\n
    // The closing --> should be on its own line
    const regex = /<!-- issue-ops-state\s*\n([\s\S]*?)\n-->/;
    const match = commentBody.match(regex);

    if (!match || !match[1]) {
      throw new InvalidStateError(
        'State marker found but JSON content is missing',
        { commentBody: commentBody.substring(0, 100) },
      );
    }

    try {
      const state = JSON.parse(match[1]) as WorkflowState;
      this.validateState(state);
      return state;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      throw new InvalidStateError(
        `Failed to parse state JSON: ${errorMessage}`,
        {
          jsonContent: match[1].substring(0, 200),
        },
      );
    }
  }

  /**
   * Validate workflow state structure
   * @param state - State to validate
   * @throws InvalidStateError if validation fails
   */
  private validateState(state: WorkflowState): void {
    if (!state.version) {
      throw new InvalidStateError('State version is required');
    }

    if (!state.workflowType) {
      throw new InvalidStateError('Workflow type is required');
    }

    if (!state.issueNumber || state.issueNumber <= 0) {
      throw new InvalidStateError('Valid issue number is required', {
        issueNumber: state.issueNumber,
      });
    }

    if (!state.status) {
      throw new InvalidStateError('Workflow status is required');
    }

    if (!state.currentStage) {
      throw new InvalidStateError('Current stage is required');
    }

    if (!state.stages || Object.keys(state.stages).length === 0) {
      throw new InvalidStateError('At least one stage is required');
    }

    if (!state.createdAt) {
      throw new InvalidStateError('Created timestamp is required');
    }

    if (!state.updatedAt) {
      throw new InvalidStateError('Updated timestamp is required');
    }
  }

  /**
   * Format workflow status with emoji
   */
  private formatStatus(status: string): string {
    const statusEmojis: Record<string, string> = {
      active: '▶️ Active',
      paused: '⏸️ Paused',
      completed: '✅ Completed',
      cancelled: '❌ Cancelled',
      failed: '⛔ Failed',
    };

    return statusEmojis[status] || status;
  }

  /**
   * Get emoji for stage based on position and status
   */
  private getStageEmoji(
    stageName: string,
    currentStage: string,
    status: string,
  ): string {
    if (status === 'completed') return '✅';
    if (status === 'blocked') return '⛔';
    if (status === 'skipped') return '⏭️';
    if (stageName === currentStage) return '▶️';
    if (status === 'in_progress') return '🔄';
    return '⏸️';
  }

  /**
   * Format ISO date to relative time or short date
   */
  private formatDate(isoDate: string): string {
    const date = new Date(isoDate);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));

    if (diffHours < 1) {
      const diffMinutes = Math.floor(diffMs / (1000 * 60));
      return `${diffMinutes} minute${diffMinutes !== 1 ? 's' : ''} ago`;
    }

    if (diffHours < 24) {
      return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
    }

    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 7) {
      return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`;
    }

    return date.toLocaleDateString();
  }
}
