import type { GitHubService } from '../adapters/github-service.js';
import { WorkflowError } from '../models/errors.js';
import {
  StageStatus,
  TransitionEvent,
  WorkflowStatus,
} from '../models/types.js';
import type {
  StageTransition,
  WorkflowDefinition,
} from '../models/workflow-definition.js';
import type { StageState, WorkflowState } from '../models/workflow-state.js';
import { CommentGenerator } from './comment-generator.js';
import { Logger } from './logger.js';
import { StateManager } from './state-manager.js';

/**
 * Workflow orchestrator service
 * Manages workflow initialization, stage transitions, and state updates
 */
export class WorkflowOrchestrator {
  private readonly logger = new Logger();
  private readonly commentGenerator = new CommentGenerator();

  constructor(
    private readonly stateManager: StateManager,
    private readonly github: GitHubService,
  ) {}

  /**
   * Initialize a new workflow from definition
   * Creates initial state and posts initialization comment
   * @param issueNumber - Issue to initialize workflow for
   * @param workflowDef - Workflow definition to use
   * @param data - Issue data for context
   * @returns Initial workflow state
   */
  async initializeWorkflow(
    issueNumber: number,
    workflowDef: WorkflowDefinition,
    data: Record<string, unknown>,
  ): Promise<WorkflowState> {
    this.logger.info(
      `Initializing workflow ${workflowDef.type} for issue #${issueNumber}`,
    );

    // Create initial state with all stages pending
    const now = new Date().toISOString();
    const stages: Record<string, StageState> = {};

    for (const stageDef of workflowDef.stages) {
      stages[stageDef.name] = {
        name: stageDef.name,
        status: StageStatus.PENDING,
        taskIssues: [],
      };
    }

    // First stage starts immediately
    const firstStage = workflowDef.stages[0];
    if (!firstStage) {
      throw new WorkflowError(
        'Workflow definition must have at least one stage',
        'initializeWorkflow',
        false,
        { workflowType: workflowDef.type },
      );
    }

    stages[firstStage.name]!.status = StageStatus.IN_PROGRESS;
    stages[firstStage.name]!.startedAt = now;

    const initialState: WorkflowState = {
      version: '1.0.0',
      workflowType: workflowDef.type,
      issueNumber,
      status: WorkflowStatus.ACTIVE,
      currentStage: firstStage.name,
      data,
      stages,
      createdAt: now,
      updatedAt: now,
    };

    // Save initial state
    await this.stateManager.saveState(initialState);

    // Post initialization comment
    const stageNames = workflowDef.stages.map((s) => s.name);
    const comment = this.commentGenerator.generateWorkflowInitComment(
      workflowDef.name,
      stageNames,
    );
    await this.github.createComment(issueNumber, comment);

    this.logger.info(`Workflow initialized for issue #${issueNumber}`);
    return initialState;
  }

  /**
   * Transition workflow to next stage based on event
   * @param issueNumber - Issue to transition
   * @param event - Event that triggered transition
   * @param workflowDef - Workflow definition
   * @returns Updated workflow state or null if no transition occurred
   */
  async transitionStage(
    issueNumber: number,
    event: TransitionEvent,
    workflowDef: WorkflowDefinition,
  ): Promise<WorkflowState | null> {
    this.logger.info(
      `Processing transition event ${event} for issue #${issueNumber}`,
    );

    // Load current state
    const state = await this.stateManager.loadState(issueNumber);
    if (!state) {
      throw new WorkflowError(
        'Cannot transition: workflow state not found',
        'transitionStage',
        false,
        { issueNumber, event },
      );
    }

    // Check if workflow is completed or cancelled
    if (
      state.status === WorkflowStatus.COMPLETED ||
      state.status === WorkflowStatus.CANCELLED
    ) {
      this.logger.info(`Workflow already ${state.status}, skipping transition`);
      return null;
    }

    // Find current stage definition
    const currentStageDef = workflowDef.stages.find(
      (s) => s.name === state.currentStage,
    );
    if (!currentStageDef) {
      throw new WorkflowError(
        `Current stage "${state.currentStage}" not found in workflow definition`,
        'transitionStage',
        false,
        { issueNumber, currentStage: state.currentStage },
      );
    }

    // Find matching transition
    const transition = currentStageDef.transitions.find(
      (t) => t.event === event,
    );
    if (!transition) {
      this.logger.debug(
        `No transition found for event ${event} in stage ${state.currentStage}`,
      );
      return null;
    }

    // Check transition condition if present
    if (transition.condition && !transition.condition(state)) {
      this.logger.info(
        `Transition condition not met for ${state.currentStage} → ${transition.targetStage}`,
      );
      return null;
    }

    // Execute transition
    return await this.executeTransition(
      state,
      transition,
      currentStageDef.name,
      workflowDef,
    );
  }

  /**
   * Execute a stage transition
   * Updates state, performs actions, posts comments
   * @param state - Current workflow state
   * @param transition - Transition to execute
   * @param fromStage - Source stage name
   * @param workflowDef - Workflow definition
   * @returns Updated workflow state
   */
  private async executeTransition(
    state: WorkflowState,
    transition: StageTransition,
    fromStage: string,
    workflowDef: WorkflowDefinition,
  ): Promise<WorkflowState> {
    const now = new Date().toISOString();

    this.logger.info(
      `Executing transition: ${fromStage} → ${transition.targetStage}`,
    );

    // Mark current stage as completed (unless already skipped)
    if (state.stages[fromStage]) {
      if (state.stages[fromStage].status !== StageStatus.SKIPPED) {
        state.stages[fromStage].status = StageStatus.COMPLETED;
        state.stages[fromStage].completedAt = now;
      }
    }

    // Find target stage definition
    const targetStageDef = workflowDef.stages.find(
      (s) => s.name === transition.targetStage,
    );

    if (!targetStageDef) {
      // No target stage means workflow is complete
      state.status = WorkflowStatus.COMPLETED;
      state.currentStage = fromStage; // Stay on final stage
      state.updatedAt = now;

      await this.stateManager.saveState(state);

      // Post completion comment
      await this.github.createComment(
        state.issueNumber,
        '## 🎉 Workflow Complete!\n\nAll stages have been completed successfully. This issue can now be closed.',
      );

      this.logger.info(`Workflow completed for issue #${state.issueNumber}`);
      return state;
    }

    // Move to target stage
    state.currentStage = transition.targetStage;
    state.updatedAt = now;

    // Initialize target stage state if needed
    if (!state.stages[transition.targetStage]) {
      state.stages[transition.targetStage] = {
        name: transition.targetStage,
        status: StageStatus.PENDING,
        taskIssues: [],
      };
    }

    // Check if target stage has grace period
    if (targetStageDef.gracePeriodDays) {
      // Start grace period
      const gracePeriodEnd = new Date();
      gracePeriodEnd.setDate(
        gracePeriodEnd.getDate() + targetStageDef.gracePeriodDays,
      );

      state.stages[transition.targetStage]!.status = StageStatus.IN_PROGRESS;
      state.stages[transition.targetStage]!.startedAt = now;
      state.stages[transition.targetStage]!.gracePeriodEndsAt =
        gracePeriodEnd.toISOString();
      state.status = WorkflowStatus.PAUSED;

      await this.stateManager.saveState(state);

      // Post grace period comment
      const comment = this.commentGenerator.generateStageComment(
        transition.targetStage,
        targetStageDef.description,
        `Grace period: ${targetStageDef.gracePeriodDays} days`,
      );
      await this.github.createComment(state.issueNumber, comment);

      // Add grace period label
      await this.github.addLabels(state.issueNumber, ['paused: grace-period']);

      this.logger.info(
        `Grace period started for ${targetStageDef.gracePeriodDays} days`,
      );
    } else {
      // Normal stage transition
      state.stages[transition.targetStage]!.status = StageStatus.IN_PROGRESS;
      state.stages[transition.targetStage]!.startedAt = now;

      await this.stateManager.saveState(state);

      // Post stage transition comment
      const comment = this.commentGenerator.generateStageComment(
        transition.targetStage,
        targetStageDef.description,
      );
      await this.github.createComment(state.issueNumber, comment);

      this.logger.info(`Transitioned to stage: ${transition.targetStage}`);
    }

    // Execute transition actions
    if (transition.actions) {
      await this.executeTransitionActions(state, transition.actions);
    }

    return state;
  }

  /**
   * Execute actions associated with a transition
   * @param state - Current workflow state
   * @param actions - Actions to execute
   */
  private async executeTransitionActions(
    state: WorkflowState,
    actions: NonNullable<StageTransition['actions']>,
  ): Promise<void> {
    for (const action of actions) {
      try {
        switch (action.type) {
          case 'add_label':
            await this.github.addLabels(state.issueNumber, [
              String(action.payload.label),
            ]);
            break;

          case 'remove_label':
            await this.github.removeLabel(
              state.issueNumber,
              String(action.payload.label),
            );
            break;

          case 'post_comment':
            await this.github.createComment(
              state.issueNumber,
              String(action.payload.body),
            );
            break;

          case 'notify':
            // TODO: Implement notification (mention users)
            this.logger.info(
              `Notification action not yet implemented: ${JSON.stringify(action.payload)}`,
            );
            break;

          default:
            this.logger.warn(`Unknown action type: ${action.type}`);
        }
      } catch (error) {
        this.logger.error(
          `Failed to execute action ${action.type}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        );
        // Continue with other actions even if one fails
      }
    }
  }

  /**
   * Check if a transition is possible
   * @param state - Current workflow state
   * @param event - Event to check
   * @param workflowDef - Workflow definition
   * @returns True if transition is possible
   */
  canTransition(
    state: WorkflowState,
    event: TransitionEvent,
    workflowDef: WorkflowDefinition,
  ): boolean {
    const currentStageDef = workflowDef.stages.find(
      (s) => s.name === state.currentStage,
    );
    if (!currentStageDef) {
      return false;
    }

    const transition = currentStageDef.transitions.find(
      (t) => t.event === event,
    );
    if (!transition) {
      return false;
    }

    if (transition.condition && !transition.condition(state)) {
      return false;
    }

    return true;
  }

  /**
   * Manually skip current stage (if allowed)
   * @param issueNumber - Issue to update
   * @param workflowDef - Workflow definition
   * @param reason - Reason for skipping
   * @returns Updated state or null if skip not allowed
   */
  async skipStage(
    issueNumber: number,
    workflowDef: WorkflowDefinition,
    reason: string,
  ): Promise<WorkflowState | null> {
    const state = await this.stateManager.loadState(issueNumber);
    if (!state) {
      throw new WorkflowError(
        'Cannot skip stage: workflow state not found',
        'skipStage',
        false,
        { issueNumber },
      );
    }

    const currentStageDef = workflowDef.stages.find(
      (s) => s.name === state.currentStage,
    );

    if (!currentStageDef?.allowManualSkip) {
      this.logger.warn(`Stage ${state.currentStage} cannot be skipped`);
      return null;
    }

    // Mark as skipped
    if (state.stages[state.currentStage]) {
      state.stages[state.currentStage]!.status = StageStatus.SKIPPED;
      state.stages[state.currentStage]!.completedAt = new Date().toISOString();
      state.stages[state.currentStage]!.notes = `Skipped: ${reason}`;
    }

    await this.stateManager.saveState(state);

    // Post skip comment
    await this.github.createComment(
      issueNumber,
      `## ⏭️ Stage Skipped\n\n**Stage**: ${state.currentStage}\n**Reason**: ${reason}`,
    );

    this.logger.info(`Stage ${state.currentStage} skipped: ${reason}`);

    // Trigger manual_skip event to transition to next stage
    return await this.transitionStage(
      issueNumber,
      TransitionEvent.MANUAL_SKIP,
      workflowDef,
    );
  }
}
