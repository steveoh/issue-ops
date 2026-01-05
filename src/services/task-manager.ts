import type { GitHubService } from '../adapters/github-service.js';
import { TaskError } from '../models/errors.js';
import type { TaskIssue } from '../models/task.js';
import { TaskStatus } from '../models/types.js';
import type { TaskTemplate } from '../models/workflow-definition.js';
import { Logger } from './logger.js';
import { StateManager } from './state-manager.js';

/**
 * Task manager service
 * Handles creation and tracking of task issues within workflow stages
 */
export class TaskManager {
  private readonly logger = new Logger();

  constructor(
    private readonly github: GitHubService,
    private readonly stateManager: StateManager,
  ) {}

  /**
   * Create task issues for a workflow stage
   * @param parentIssueNumber - Parent workflow issue
   * @param stage - Stage name these tasks belong to
   * @param templates - Task templates to create
   * @param assignee - Default assignee (can be overridden per task)
   * @param variables - Variables for template interpolation
   * @returns Created task issues
   */
  async createTaskIssues(
    parentIssueNumber: number,
    stage: string,
    templates: TaskTemplate[],
    assignee?: string,
    variables?: Record<string, string>,
  ): Promise<TaskIssue[]> {
    this.logger.info(
      `Creating ${templates.length} task(s) for stage ${stage} in issue #${parentIssueNumber}`,
    );

    const createdTasks: TaskIssue[] = [];

    for (const template of templates) {
      try {
        // Interpolate variables in title and body
        const title = this.interpolate(template.title, variables);
        const body = this.interpolate(template.body, variables);

        // Add parent reference to body
        const enhancedBody = `${body}\n\n---\n\n**Parent Issue**: #${parentIssueNumber}\n**Stage**: ${stage}`;

        // Determine assignee (template overrides default)
        const taskAssignee = template.assignee || assignee;

        // Create the issue
        const issueNumber = await this.github.createIssue({
          title,
          body: enhancedBody,
          labels: template.labels,
          assignees: taskAssignee ? [taskAssignee] : [],
        });

        const taskIssue: TaskIssue = {
          number: issueNumber,
          title,
          status: TaskStatus.OPEN,
          assignee: taskAssignee,
          parentIssue: parentIssueNumber,
          stage,
          createdAt: new Date().toISOString(),
          url: `https://github.com/${this.github.owner}/${this.github.repo}/issues/${issueNumber}`,
        };

        createdTasks.push(taskIssue);

        this.logger.info(`Created task issue #${issueNumber}: ${title}`);
      } catch (error) {
        this.logger.error(
          `Failed to create task issue: ${error instanceof Error ? error.message : 'Unknown error'}`,
        );
        throw new TaskError(
          `Failed to create task issue from template: ${template.title}`,
          -1,
          { stage, parentIssueNumber },
        );
      }
    }

    // Update workflow state with new task issues
    await this.addTasksToState(parentIssueNumber, stage, createdTasks);

    // Post summary comment on parent issue
    await this.postTaskSummary(parentIssueNumber, stage, createdTasks);

    return createdTasks;
  }

  /**
   * Check if all tasks for a stage are completed
   * @param parentIssueNumber - Parent workflow issue
   * @param stage - Stage to check
   * @returns True if all tasks completed
   */
  async areAllTasksCompleted(
    parentIssueNumber: number,
    stage: string,
  ): Promise<boolean> {
    const state = await this.stateManager.loadState(parentIssueNumber);
    if (!state) {
      throw new TaskError(
        'Cannot check task status: workflow state not found',
        -1,
        { parentIssueNumber, stage },
      );
    }

    const stageState = state.stages[stage];
    if (!stageState || !stageState.taskIssues) {
      // No tasks for this stage means "completed by default"
      return true;
    }

    // All tasks must be completed
    return stageState.taskIssues.every(
      (task) => task.status === TaskStatus.COMPLETED,
    );
  }

  /**
   * Update task status when a task issue is closed
   * @param taskIssueNumber - Task issue that was closed
   * @returns Parent issue number if found, null otherwise
   */
  async handleTaskClosed(taskIssueNumber: number): Promise<number | null> {
    this.logger.info(`Handling closure of task issue #${taskIssueNumber}`);

    // Find the parent issue by checking issue body for parent reference
    // In a real implementation, you'd query the issue or use labels
    // For now, we'll search through all known states

    // TODO: Implement efficient task-to-parent lookup by using github api to find parent issue
    this.logger.warn(
      'Task-to-parent lookup not yet implemented. Use labels or state mapping.',
    );

    return null;
  }

  /**
   * Update task status in workflow state
   * @param parentIssueNumber - Parent workflow issue
   * @param taskIssueNumber - Task issue to update
   * @param status - New status
   */
  async updateTaskStatus(
    parentIssueNumber: number,
    taskIssueNumber: number,
    status: TaskStatus,
  ): Promise<void> {
    const state = await this.stateManager.loadState(parentIssueNumber);
    if (!state) {
      throw new TaskError(
        'Cannot update task status: workflow state not found',
        taskIssueNumber,
        { parentIssueNumber },
      );
    }

    // Find the task in any stage
    let taskFound = false;
    for (const stage of Object.values(state.stages)) {
      const task = stage.taskIssues?.find((t) => t.number === taskIssueNumber);
      if (task) {
        task.status = status;
        if (status === TaskStatus.COMPLETED) {
          task.completedAt = new Date().toISOString();
        }
        taskFound = true;
        break;
      }
    }

    if (!taskFound) {
      throw new TaskError(
        `Task issue #${taskIssueNumber} not found in workflow state`,
        taskIssueNumber,
        { parentIssueNumber },
      );
    }

    await this.stateManager.saveState(state);

    this.logger.info(`Updated task #${taskIssueNumber} status to ${status}`);
  }

  /**
   * Get task completion summary for a stage
   * @param parentIssueNumber - Parent workflow issue
   * @param stage - Stage to summarize
   * @returns Summary object
   */
  async getTaskSummary(
    parentIssueNumber: number,
    stage: string,
  ): Promise<{
    total: number;
    completed: number;
    remaining: number;
    tasks: TaskIssue[];
  }> {
    const state = await this.stateManager.loadState(parentIssueNumber);
    if (!state) {
      throw new TaskError(
        'Cannot get task summary: workflow state not found',
        -1,
        { parentIssueNumber, stage },
      );
    }

    const stageState = state.stages[stage];
    const tasks = stageState?.taskIssues || [];

    const completed = tasks.filter(
      (t) => t.status === TaskStatus.COMPLETED,
    ).length;

    return {
      total: tasks.length,
      completed,
      remaining: tasks.length - completed,
      tasks,
    };
  }

  /**
   * Add created tasks to workflow state
   * @param parentIssueNumber - Parent workflow issue
   * @param stage - Stage name
   * @param tasks - Tasks to add
   */
  private async addTasksToState(
    parentIssueNumber: number,
    stage: string,
    tasks: TaskIssue[],
  ): Promise<void> {
    const state = await this.stateManager.loadState(parentIssueNumber);
    if (!state) {
      throw new TaskError(
        'Cannot add tasks to state: workflow state not found',
        -1,
        { parentIssueNumber, stage },
      );
    }

    if (!state.stages[stage]) {
      throw new TaskError(`Stage "${stage}" not found in workflow state`, -1, {
        parentIssueNumber,
        stage,
      });
    }

    // Initialize taskIssues array if needed
    if (!state.stages[stage].taskIssues) {
      state.stages[stage].taskIssues = [];
    }

    // Add new tasks
    state.stages[stage].taskIssues!.push(...tasks);

    await this.stateManager.saveState(state);
  }

  /**
   * Post task summary comment on parent issue
   * @param parentIssueNumber - Parent issue
   * @param stage - Stage name
   * @param tasks - Created tasks
   */
  private async postTaskSummary(
    parentIssueNumber: number,
    stage: string,
    tasks: TaskIssue[],
  ): Promise<void> {
    let comment = `## 📋 Tasks Created for Stage: ${stage}\n\n`;

    if (tasks.length === 0) {
      comment += '_No tasks to complete for this stage._\n';
    } else {
      comment += 'The following tasks have been created:\n\n';

      for (const task of tasks) {
        const assigneeText = task.assignee ? ` (@${task.assignee})` : '';
        comment += `- [ ] #${task.number} - ${task.title}${assigneeText}\n`;
      }

      comment += `\n**Progress**: 0/${tasks.length} completed\n`;
    }

    await this.github.createComment(parentIssueNumber, comment);
  }

  /**
   * Interpolate variables in template string
   * @param template - Template string with {{variable}} placeholders
   * @param variables - Variable values
   * @returns Interpolated string
   */
  private interpolate(
    template: string,
    variables?: Record<string, string>,
  ): string {
    if (!variables) {
      return template;
    }

    let result = template;
    for (const [key, value] of Object.entries(variables)) {
      const placeholder = new RegExp(`{{\\s*${key}\\s*}}`, 'g');
      result = result.replace(placeholder, value);
    }

    return result;
  }
}
