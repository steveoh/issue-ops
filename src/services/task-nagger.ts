import type { GitHubService } from '../adapters/github-service.js';
import type { WorkflowState } from '../models/workflow-state.js';
import { StageStatus, WorkflowStatus, TaskStatus } from '../models/types.js';
import { Logger } from './logger.js';
import { StateManager } from './state-manager.js';

/**
 * Task nagging service
 * Posts reminder comments for incomplete tasks on a schedule
 */
export class TaskNagger {
  private readonly logger = new Logger();

  constructor(
    private readonly stateManager: StateManager,
    private readonly github: GitHubService,
  ) {}

  /**
   * Check if it's Monday morning in Mountain Time
   * @param date - Date to check (defaults to now)
   * @returns True if it's Monday between 6am-9am MT
   */
  isMondayMorning(date: Date = new Date()): boolean {
    // Convert to Mountain Time (UTC-7 or UTC-6 depending on DST)
    // Using Intl.DateTimeFormat for proper timezone handling
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Denver',
      weekday: 'long',
      hour: 'numeric',
      hour12: false,
    });

    const parts = formatter.formatToParts(date);
    const weekday = parts.find((p) => p.type === 'weekday')?.value;
    const hour = parseInt(parts.find((p) => p.type === 'hour')?.value || '0', 10);

    return weekday === 'Monday' && hour >= 6 && hour < 9;
  }

  /**
   * Get the last nag timestamp from workflow state
   * @param state - Workflow state
   * @returns ISO timestamp of last nag, or null if never nagged
   */
  private getLastNagTime(state: WorkflowState): string | null {
    const lastNagTime = state.featureFlags?.lastNagTime;
    if (typeof lastNagTime === 'string') {
      return lastNagTime;
    }
    return null;
  }

  /**
   * Check if we should nag (at least 7 days since last nag)
   * @param state - Workflow state
   * @returns True if enough time has passed
   */
  private shouldNag(state: WorkflowState): boolean {
    const lastNag = this.getLastNagTime(state);
    if (!lastNag) {
      return true; // Never nagged before
    }

    const lastNagDate = new Date(lastNag);
    const daysSinceNag = (Date.now() - lastNagDate.getTime()) / (1000 * 60 * 60 * 24);

    return daysSinceNag >= 7;
  }

  /**
   * Count incomplete tasks for current stage
   * @param state - Workflow state
   * @returns Number of incomplete tasks
   */
  private countIncompleteTasks(state: WorkflowState): number {
    const currentStageState = state.stages[state.currentStage];
    if (!currentStageState?.taskIssues) {
      return 0;
    }

    return currentStageState.taskIssues.filter(
      (task) => task.status !== TaskStatus.COMPLETED,
    ).length;
  }

  /**
   * Generate nag comment text
   * @param state - Workflow state
   * @param incompleteTasks - Number of incomplete tasks
   * @returns Markdown comment text
   */
  private generateNagComment(
    state: WorkflowState,
    incompleteTasks: number,
  ): string {
    const stageName = state.currentStage;
    const currentStageState = state.stages[stageName];

    let comment = `## 📌 Weekly Reminder\n\n`;
    comment += `**Stage**: ${stageName}\n`;
    comment += `**Status**: ${incompleteTasks} task${incompleteTasks !== 1 ? 's' : ''} remaining\n\n`;

    if (currentStageState?.taskIssues) {
      const incompleteTasks = currentStageState.taskIssues.filter(
        (task) => task.status !== TaskStatus.COMPLETED,
      );

      if (incompleteTasks.length > 0) {
        comment += `### Incomplete Tasks:\n\n`;
        for (const task of incompleteTasks) {
          const assigneeText = task.assignee ? ` (@${task.assignee})` : '';
          comment += `- #${task.number} - ${task.title}${assigneeText}\n`;
        }
      }
    }

    comment += `\n---\n\n`;
    comment += `*This is an automated weekly reminder. Tasks are checked every Monday morning.*\n`;

    return comment;
  }

  /**
   * Nag about incomplete tasks for an issue
   * @param issueNumber - Issue to nag about
   * @returns True if nagged, false if no nag needed
   */
  async nagIssue(issueNumber: number): Promise<boolean> {
    this.logger.info(`Checking if nag needed for issue #${issueNumber}`);

    // Load workflow state
    const state = await this.stateManager.loadState(issueNumber);
    if (!state) {
      this.logger.debug(`No workflow state found for issue #${issueNumber}`);
      return false;
    }

    // Skip if workflow is completed or cancelled
    if (
      state.status === WorkflowStatus.COMPLETED ||
      state.status === WorkflowStatus.CANCELLED
    ) {
      this.logger.debug(`Workflow already ${state.status}, skipping nag`);
      return false;
    }

    // Skip if in grace period (paused)
    if (state.status === WorkflowStatus.PAUSED) {
      this.logger.debug(`Workflow paused (grace period), skipping nag`);
      return false;
    }

    // Check if current stage has incomplete tasks
    const incompleteTasks = this.countIncompleteTasks(state);
    if (incompleteTasks === 0) {
      this.logger.debug(`No incomplete tasks, skipping nag`);
      return false;
    }

    // Check if enough time has passed since last nag
    if (!this.shouldNag(state)) {
      this.logger.debug(`Not enough time since last nag, skipping`);
      return false;
    }

    // Post nag comment
    const comment = this.generateNagComment(state, incompleteTasks);
    await this.github.createComment(issueNumber, comment);

    // Update last nag time in state
    if (!state.featureFlags) {
      state.featureFlags = {};
    }
    // Store last nag time as a custom property
    (state.featureFlags as Record<string, unknown>).lastNagTime = new Date().toISOString();
    await this.stateManager.saveState(state);

    this.logger.info(`Posted nag comment for issue #${issueNumber}`);
    return true;
  }

  /**
   * Nag all active workflow issues
   * Typically called by scheduled GitHub Action
   * @param issueNumbers - Optional array of specific issues to check
   * @returns Number of issues nagged
   */
  async nagAllActiveIssues(issueNumbers?: number[]): Promise<number> {
    this.logger.info(`Starting nag check for active workflow issues`);

    // If no specific issues provided, would need to query GitHub for active issues
    // For now, this requires explicit issue numbers
    if (!issueNumbers || issueNumbers.length === 0) {
      this.logger.warn(
        'No issue numbers provided to nagAllActiveIssues. Use GitHub search to find active workflow issues.',
      );
      return 0;
    }

    let naggedCount = 0;
    for (const issueNumber of issueNumbers) {
      try {
        const nagged = await this.nagIssue(issueNumber);
        if (nagged) {
          naggedCount++;
        }
      } catch (error) {
        this.logger.error(
          `Failed to nag issue #${issueNumber}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        );
      }
    }

    this.logger.info(`Nagged ${naggedCount} issue(s)`);
    return naggedCount;
  }

  /**
   * Check if nag should run based on current time
   * Use this in GitHub Actions workflow
   * @returns True if it's Monday morning MT
   */
  shouldRunNagJob(): boolean {
    return this.isMondayMorning();
  }
}
