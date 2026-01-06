# MVP Plan: SGID Deprecation Workflow (Option B - Deprecations Only)

**Goal**: Refactor current implementation into modular architecture, focusing exclusively on SGID deprecation workflow as MVP.

**Timeline**: 3-4 weeks  
**Priority**: Architecture quality over speed (sets foundation for future workflows)

---

## Why Skip T007 (action.yml)?

**Your Current Setup is BETTER for development:**

✅ **Current** (`.github/workflows/issues.yml`):

- Build TypeScript on every run → Always fresh code
- Can use `pnpm dev` for local testing
- Can add npm scripts without workflow changes
- Fast iteration: edit → commit → push → test

❌ **With action.yml**:

- Must bundle with `@vercel/ncc` → Slower builds
- Must commit `dist/` folder → Clutters git history
- Harder to debug bundled code
- Extra build step in every change

**Recommendation**: **Skip T007 until you publish to GitHub Marketplace or need to share with other repos**. Your current workflow is perfect for MVP.

---

## MVP Scope: Deprecation-Only Refactoring

### What We're Building

**Single Workflow**: SGID Deprecation with full orchestration

**Features**:

1. ✅ Parse deprecation issue template
2. ✅ Validate data exists in systems (ArcGIS, Sheets, PostgreSQL, Product pages)
3. 🆕 **Stage 1**: Initial Review → Create verification tasks
4. 🆕 **Stage 2**: Impact Assessment → Assign to data steward
5. 🆕 **Stage 3**: Grace Period (30 days) → Pause with label
6. 🆕 **Stage 4**: Final Review → Assign to technical lead
7. 🆕 **Stage 5**: Removal → Create removal tasks
8. 🆕 Track state in JSON comment (action plan + progress)
9. 🆕 Scheduled daily check for grace period expiration

**Out of Scope** (defer to post-MVP):

- ❌ SGID additions workflow
- ❌ Application workflows
- ❌ Internal SGID deprecations
- ❌ Firestore persistence
- ❌ Multi-repo distribution (action.yml)

---

## Phase-by-Phase Implementation

### Week 1: Refactor to Modular Architecture (Foundation)

**Goal**: Extract current code into clean services/adapters without changing behavior.

#### Day 1-2: Create Type System & Directory Structure

```bash
# Create directories
mkdir -p src/{models,services,adapters,workflows}

# Move existing files to temporary locations
mv src/parsing.ts src/parsing.ts.bak
mv src/schema.ts src/schema.ts.bak
mv src/github.ts src/github.ts.bak
mv src/database.ts src/database.ts.bak
mv src/sheets.ts src/sheets.ts.bak
```

**Tasks**:

- [x] T001 ✅ (directories exist, just add subdirs)
- [ ] T009: Create type system in `src/models/types.ts`

  ```typescript
  export enum WorkflowType {
    SGID_DEPRECATION = 'sgid-deprecation',
  }

  export enum WorkflowStatus {
    ACTIVE = 'active',
    PAUSED = 'paused',
    COMPLETED = 'completed',
    CANCELLED = 'cancelled',
  }

  export enum StageStatus {
    PENDING = 'pending',
    IN_PROGRESS = 'in_progress',
    COMPLETED = 'completed',
    BLOCKED = 'blocked',
  }

  export enum TaskStatus {
    OPEN = 'open',
    IN_PROGRESS = 'in_progress',
    COMPLETED = 'completed',
    CANCELLED = 'cancelled',
  }
  ```

- [ ] T010: Create `src/models/workflow-state.ts`

  ```typescript
  import { WorkflowType, WorkflowStatus, StageStatus } from './types.js';

  export interface WorkflowState {
    version: string;
    workflowType: WorkflowType;
    issueNumber: number;
    status: WorkflowStatus;
    currentStage: string;
    data: Record<string, unknown>; // Parsed issue data
    stages: Record<string, StageState>;
    featureFlags?: Record<string, boolean>;
    createdAt: string;
    updatedAt: string;
  }

  export interface StageState {
    name: string;
    status: StageStatus;
    assignee?: string;
    taskIssues: number[];
    startedAt?: string;
    completedAt?: string;
  }
  ```

- [ ] T011: Create `src/models/workflow-definition.ts`

  ```typescript
  export interface WorkflowDefinition {
    type: WorkflowType;
    name: string;
    stages: Stage[];
  }

  export interface Stage {
    name: string;
    description: string;
    assigneeRole: string;
    tasks: TaskTemplate[];
    transitions: StageTransition[];
    gracePeriodDays?: number; // For grace period stage
  }

  export interface TaskTemplate {
    title: string;
    body: string; // Markdown with {{variable}} placeholders
    labels: string[];
  }

  export interface StageTransition {
    event: 'task_completed' | 'grace_period_expired' | 'manual_override';
    targetStage: string;
    condition?: (state: WorkflowState) => boolean;
  }
  ```

- [ ] T012: Create `src/models/task.ts`
- [ ] T013: Create `src/models/feature-flags.ts`
- [ ] T026: Create `src/models/errors.ts`

**Checkpoint**: Type system complete, can import types everywhere.

---

#### Day 3-4: Extract Adapters (Service Wrappers)

**Goal**: Move external service calls behind clean interfaces.

- [ ] T080-T081: Move `database.ts` → `src/adapters/postgres-service.ts`

  ```typescript
  export class PostgresService {
    async tableExists(schema: string, table: string): Promise<boolean> {
      // Move pgTableExists() here
    }
  }
  ```

- [ ] T078-T079: Move `sheets.ts` → `src/adapters/sheets-service.ts`

  ```typescript
  export class SheetsService {
    async validateSgidIndexId(id: string): Promise<number> {
      // Move validateSgidIndexId() here
    }
  }
  ```

- [ ] T076-T077: Extract ArcGIS logic from `schema.ts` → `src/adapters/arcgis-service.ts`

  ```typescript
  export class ArcGISService {
    async getItemDetails(
      itemId: string,
    ): Promise<{ access: string; id: string }> {
      // Extract from schema.ts lines 206-264
    }

    async getItemGroups(itemId: string): Promise<string[]> {
      // Extract from schema.ts lines 266-321
    }
  }
  ```

- [ ] T084: Extract ky usage → `src/adapters/http-client.ts`

  ```typescript
  export class HttpClient {
    async head(url: string): Promise<void> {
      // Validate URL exists (for product pages)
    }

    async get<T>(url: string): Promise<T> {
      // With retry logic
    }
  }
  ```

- [ ] T017-T018: Refactor `github.ts` → `src/adapters/github-service.ts`
  ```typescript
  export class GitHubService {
    constructor(
      private octokit: Octokit,
      private owner: string,
      private repo: string,
    ) {}

    async createComment(issueNumber: number, body: string): Promise<void>;
    async updateComment(commentId: number, body: string): Promise<void>;
    async findBotComment(
      issueNumber: number,
      marker: string,
    ): Promise<number | null>;
    async addLabels(issueNumber: number, labels: string[]): Promise<void>;
    async removeLabel(issueNumber: number, label: string): Promise<void>;
    async getLabels(issueNumber: number): Promise<string[]>;
    async createIssue(params: CreateIssueParams): Promise<number>;
    async closeIssue(issueNumber: number): Promise<void>;
  }
  ```

**Checkpoint**: All external services behind clean interfaces, easier to test.

---

#### Day 5: Create Services Layer

- [ ] T020: Move `parsing.ts` → `src/services/template-parser.ts`

  ```typescript
  export class TemplateParser {
    parse(issueBody: string): Record<string, unknown> {
      // Keep existing parseIssueTemplate logic
    }
  }
  ```

- [ ] T019: Create `src/services/template-detector.ts`

  ```typescript
  export class TemplateDetector {
    detect(labels: string[], body: string): WorkflowType | null {
      // For MVP, just return SGID_DEPRECATION if label matches
      if (labels.includes('type: full deprecation')) {
        return WorkflowType.SGID_DEPRECATION;
      }
      return null;
    }
  }
  ```

- [ ] T016: Extract validation from `schema.ts` → `src/services/validation-service.ts`

  ```typescript
  export class ValidationService {
    constructor(
      private arcgis: ArcGISService,
      private postgres: PostgresService,
      private sheets: SheetsService,
      private http: HttpClient
    ) {}

    async validate(data: IssueData): Promise<ValidationResult> {
      // 1. Validate schema (synchronous)
      const schemaResult = IssueDataSchema.safeParse(data);
      if (!schemaResult.success) return { success: false, errors: ... };

      // 2. Discover resources (async, using injected services)
      const discovery = await this.discoverResources(schemaResult.data);
      return { success: true, data: discovery };
    }

    private async discoverResources(data: IssueData) {
      // Move async validation from schema.ts transform here
    }
  }
  ```

- [ ] T023: Refactor comment generation → `src/services/comment-generator.ts`

  ```typescript
  export class CommentGenerator {
    generateValidationComment(result: ValidationResult): string {
      // Move generateCommentBody() here
    }

    generateStageComment(stage: Stage, data: WorkflowState): string {
      // New: Generate stage progress comments
      return `### Stage: ${stage.name}\n\nStatus: In Progress...`;
    }
  }
  ```

- [ ] T027: Create `src/services/logger.ts`
  ```typescript
  export class Logger {
    info(message: string, ...args: unknown[]): void {
      if (process.env.NODE_ENV !== 'test') {
        console.log(message, ...args);
      }
    }
    // ... error, warn, debug
  }
  ```

**Checkpoint**: All business logic in services, no direct external calls.

---

### Week 2: Build State Machine & Orchestration

**Goal**: Add workflow orchestration to manage stages and transitions.

#### Day 6-7: State Management

- [ ] T014-T015: Create `src/services/state-manager.ts`
  ```typescript
  export class StateManager {
    constructor(private github: GitHubService) {}

    async loadState(issueNumber: number): Promise<WorkflowState | null> {
      const commentId = await this.github.findBotComment(
        issueNumber,
        '<!-- issue-ops-state -->'
      );
      if (!commentId) return null;

      // Parse JSON from HTML comment
      const comment = await this.github.getComment(commentId);
      const match = comment.match(/<!-- issue-ops-state\n(.*?)\n-->/s);
      if (!match) return null;

      return JSON.parse(match[1]);
    }

    async saveState(state: WorkflowState): Promise<void> {
      const body = this.renderStateComment(state);
      const commentId = await this.github.findBotComment(
        state.issueNumber,
        '<!-- issue-ops-state -->'
      );

      if (commentId) {
        await this.github.updateComment(commentId, body);
      } else {
        await this.github.createComment(state.issueNumber, body);
      }
    }

    private renderStateComment(state: WorkflowState): string {
      // Render visible progress + hidden JSON state
      return `<!-- issue-ops-state
  ${JSON.stringify(state, null, 2)}
  -->
  ```

## 🚂 Deprecation Progress

**Current Stage**: ${state.currentStage}
**Status**: ${state.status}

${this.renderStageProgress(state)}
`;
}
}

````

**Test**: Write `state-manager.test.ts` to verify JSON round-trip.

---

#### Day 8-9: Workflow Orchestration

- [ ] T021-T022: Create `src/services/workflow-orchestrator.ts`
```typescript
export class WorkflowOrchestrator {
  constructor(
    private stateManager: StateManager,
    private taskManager: TaskManager,
    private commentGenerator: CommentGenerator,
    private github: GitHubService
  ) {}

  async initializeWorkflow(
    issueNumber: number,
    workflow: WorkflowDefinition,
    data: Record<string, unknown>
  ): Promise<void> {
    // Create initial state
    const state: WorkflowState = {
      version: '1.0.0',
      workflowType: workflow.type,
      issueNumber,
      status: WorkflowStatus.ACTIVE,
      currentStage: workflow.stages[0].name,
      data,
      stages: this.initializeStages(workflow.stages),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    await this.stateManager.saveState(state);
    await this.startStage(state, workflow.stages[0]);
  }

  async handleTaskCompleted(
    issueNumber: number,
    taskIssueNumber: number
  ): Promise<void> {
    const state = await this.stateManager.loadState(issueNumber);
    if (!state) return;

    const workflow = this.getWorkflowDefinition(state.workflowType);
    const currentStage = this.getCurrentStage(workflow, state);

    // Check if all tasks complete
    if (await this.areAllTasksComplete(state, currentStage)) {
      await this.transitionToNextStage(state, workflow, currentStage);
    }
  }

  private async transitionToNextStage(
    state: WorkflowState,
    workflow: WorkflowDefinition,
    currentStage: Stage
  ): Promise<void> {
    // Find transition
    const transition = currentStage.transitions.find(t =>
      t.event === 'task_completed'
    );
    if (!transition) return;

    // Update state
    state.stages[currentStage.name].status = StageStatus.COMPLETED;
    state.stages[currentStage.name].completedAt = new Date().toISOString();
    state.currentStage = transition.targetStage;
    state.stages[transition.targetStage].status = StageStatus.IN_PROGRESS;
    state.updatedAt = new Date().toISOString();

    await this.stateManager.saveState(state);

    // Start next stage
    const nextStage = workflow.stages.find(s => s.name === transition.targetStage);
    if (nextStage) {
      await this.startStage(state, nextStage);
    }
  }

  private async startStage(state: WorkflowState, stage: Stage): Promise<void> {
    // Post stage comment
    const comment = this.commentGenerator.generateStageComment(stage, state);
    await this.github.createComment(state.issueNumber, comment);

    // Create task issues
    await this.taskManager.createTasks(state, stage);

    // Handle grace period
    if (stage.gracePeriodDays) {
      await this.github.addLabels(state.issueNumber, ['status: paused-grace-period']);
      state.status = WorkflowStatus.PAUSED;
      await this.stateManager.saveState(state);
    }
  }
}
````

---

#### Day 10: Task Management

- [ ] T034: Create `src/services/task-manager.ts`
  ```typescript
  export class TaskManager {
    constructor(private github: GitHubService) {}

    async createTasks(state: WorkflowState, stage: Stage): Promise<number[]> {
      const taskIssues: number[] = [];

      for (const taskTemplate of stage.tasks) {
        const title = this.renderTemplate(taskTemplate.title, state.data);
        const body = this.renderTemplate(taskTemplate.body, state.data);

        const taskNumber = await this.github.createIssue({
          title,
          body: `${body}\n\n---\n_Parent Issue: #${state.issueNumber}_`,
          labels: [...taskTemplate.labels, `parent: #${state.issueNumber}`],
        });

        taskIssues.push(taskNumber);
      }

      // Update state with task issue numbers
      state.stages[stage.name].taskIssues = taskIssues;

      return taskIssues;
    }

    private renderTemplate(
      template: string,
      data: Record<string, unknown>,
    ): string {
      return template.replace(/\{\{(\w+)\}\}/g, (_, key) =>
        String(data[key] ?? `{{${key}}}`),
      );
    }
  }
  ```

**Checkpoint**: Can initialize workflows, create tasks, transition stages.

---

### Week 3: Implement SGID Deprecation Workflow

**Goal**: Define deprecation workflow and integrate with orchestrator.

#### Day 11-12: Workflow Definition

- [ ] T040: Create deprecation issue template in `.github/ISSUE_TEMPLATE/sgid-deprecation.yml`

  ```yaml
  name: 🗑️ SGID Deprecation Request
  description: Request to deprecate an SGID layer
  labels: ['type: full deprecation', 'status: waiting on actions']
  body:
    - type: input
      id: display-name
      attributes:
        label: Display Name
        description: Full name of the layer (e.g., "Utah Roads")
        placeholder: Utah...
      validations:
        required: true
    # ... rest of existing fields from your current template
  ```

- [ ] T041-T044: Create `src/workflows/sgid-deprecation.ts`

  ```typescript
  import { WorkflowDefinition, WorkflowType } from '../models/types.js';

  export const sgidDeprecationWorkflow: WorkflowDefinition = {
    type: WorkflowType.SGID_DEPRECATION,
    name: 'SGID Deprecation',
    stages: [
      {
        name: 'deprecation-review',
        description: 'Initial review of deprecation request',
        assigneeRole: 'data-steward',
        tasks: [
          {
            title: 'Verify deprecation justification for {{display-name}}',
            body: `Review the deprecation request for **{{display-name}}**.
  ```

**Checklist**:

- [ ] Deprecation reason is valid
- [ ] No critical dependencies identified
- [ ] Alternative data sources documented (if applicable)

**Data to review**:

- Internal SGID: {{internal-sgid-table}}
- Open SGID: {{open-sgid-table}}
- Product Page: {{product-page-url}}`,
          labels: ['task: review', 'priority: high']
        }
      ],
      transitions: [
        { event: 'task_completed', targetStage: 'impact-assessment' }
      ]
    },
    {
      name: 'impact-assessment',
      description: 'Assess impact on stakeholders and systems',
      assigneeRole: 'technical-lead',
      tasks: [
        {
          title: 'Assess impact of deprecating {{display-name}}',
          body: `Assess the impact of deprecating **{{display-name}}**.

**Checklist**:

- [ ] Identify affected systems and users
- [ ] Document notification plan for stakeholders
- [ ] Verify no active subscriptions or dependencies
- [ ] Check ArcGIS Online usage statistics

**Resources**:

- ArcGIS Online Item: {{arcgis-online-item-id}}
- SGID on ArcGIS: {{sgid-on-arcgis-url}}`,
          labels: ['task: assessment', 'priority: high']
        }
      ],
      transitions: [
        { event: 'task_completed', targetStage: 'grace-period' }
      ]
    },
    {
      name: 'grace-period',
      description: '30-day grace period for stakeholder response',
      assigneeRole: 'automated',
      gracePeriodDays: 30,
      tasks: [], // No tasks during grace period
      transitions: [
        { event: 'grace_period_expired', targetStage: 'final-review' }
      ]
    },
    {
      name: 'final-review',
      description: 'Final approval before removal',
      assigneeRole: 'data-steward',
      tasks: [
        {
          title: 'Final approval for {{display-name}} deprecation',
          body: `Grace period has expired. Provide final approval to proceed with deprecation.

**Checklist**:

- [ ] No objections received during grace period
- [ ] Stakeholders have been notified
- [ ] Removal plan is documented

**Next steps**: Upon completion, removal tasks will be created.`,
            labels: ['task: approval', 'priority: high']
          }
        ],
        transitions: [
          { event: 'task_completed', targetStage: 'removal' }
        ]
      },
      {
        name: 'removal',
        description: 'Execute deprecation and cleanup',
        assigneeRole: 'technical-lead',
        tasks: [
          {
            title: 'Remove {{display-name}} from Open SGID',
            body: `Remove **{{display-name}}** from Open SGID.

**Checklist**:

- [ ] Drop table from Open SGID: {{open-sgid-table}}
- [ ] Verify table is no longer accessible
- [ ] Update documentation`,
          labels: ['task: removal', 'priority: high']
        },
        {
          title: 'Archive {{display-name}} in ArcGIS Online',
          body: `Archive **{{display-name}}** in ArcGIS Online.

**Checklist**:

- [ ] Unshare item: {{arcgis-online-item-id}}
- [ ] Remove from public groups
- [ ] Add "Deprecated" tag
- [ ] Update item description with deprecation notice`,
          labels: ['task: removal', 'priority: high']
        },
        {
          title: 'Update product page for {{display-name}}',
          body: `Update product page with deprecation notice.

**Checklist**:

- [ ] Add deprecation banner to: {{product-page-url}}
- [ ] Link to replacement data (if applicable)
- [ ] Update SGID Index: {{sgid-index-id}}`,
      labels: ['task: removal', 'priority: medium']
      }
      ],
      transitions: [
      { event: 'task_completed', targetStage: 'completed' }
      ]
      }
      ]
      };
  ```

  ```

**Checkpoint**: Workflow definition complete with all 5 stages.

---

#### Day 13-14: Integration & Main Entry Point

- [ ] T024-T025: Create `src/services/config-loader.ts`

  ```typescript
  export class ConfigLoader {
    async load(): Promise<Config> {
      // For MVP, return hardcoded config
      return {
        assignees: {
          'data-steward': 'steveoh',
          'technical-lead': 'stdavis',
          'security-reviewer': 'rkelson',
        },
        labels: {
          // ... from config.ts
        },
      };
    }
  }
  ```

- [ ] Refactor `src/main.ts` to use new architecture:

  ```typescript
  import { Octokit } from '@octokit/rest';
  import { GitHubService } from './adapters/github-service.js';
  import { ArcGISService } from './adapters/arcgis-service.js';
  import { PostgresService } from './adapters/postgres-service.js';
  import { SheetsService } from './adapters/sheets-service.js';
  import { HttpClient } from './adapters/http-client.js';
  import { StateManager } from './services/state-manager.js';
  import { WorkflowOrchestrator } from './services/workflow-orchestrator.js';
  import { ValidationService } from './services/validation-service.js';
  import { TemplateParser } from './services/template-parser.js';
  import { TemplateDetector } from './services/template-detector.js';
  import { CommentGenerator } from './services/comment-generator.js';
  import { TaskManager } from './services/task-manager.js';
  import { Logger } from './services/logger.js';
  import { sgidDeprecationWorkflow } from './workflows/sgid-deprecation.js';

  export async function run(): Promise<void> {
    const logger = new Logger();
    logger.info('🚀 Starting issue processing...');

    // Get environment
    const issueNumber = process.env.ISSUE_NUMBER;
    const issueBody = process.env.ISSUE_BODY;
    const issueLabels = []; // TODO: Get from GitHub API
    const githubToken = process.env.GITHUB_TOKEN;
    const [owner, repo] = (process.env.GITHUB_REPOSITORY || '').split('/');

    if (!issueNumber || !issueBody || !githubToken || !owner || !repo) {
      logger.info('ℹ️ No issue data found - running in standalone mode');
      return;
    }

    // Initialize services
    const octokit = new Octokit({ auth: githubToken });
    const github = new GitHubService(octokit, owner, repo);
    const arcgis = new ArcGISService();
    const postgres = new PostgresService();
    const sheets = new SheetsService();
    const http = new HttpClient();

    const stateManager = new StateManager(github);
    const commentGenerator = new CommentGenerator();
    const taskManager = new TaskManager(github);
    const orchestrator = new WorkflowOrchestrator(
      stateManager,
      taskManager,
      commentGenerator,
      github,
    );

    const parser = new TemplateParser();
    const detector = new TemplateDetector();
    const validator = new ValidationService(arcgis, postgres, sheets, http);

    // Check if workflow already initialized
    const existingState = await stateManager.loadState(parseInt(issueNumber));
    if (existingState) {
      logger.info('✅ Workflow already initialized, state loaded');
      // TODO: Handle issue edits / task completions
      return;
    }

    // Detect workflow type
    const workflowType = detector.detect(issueLabels, issueBody);
    if (!workflowType) {
      logger.info('ℹ️ No matching workflow found');
      return;
    }

    // Parse and validate
    const data = parser.parse(issueBody);
    const validationResult = await validator.validate(data);

    // Post validation comment (keep existing behavior)
    const validationComment =
      commentGenerator.generateValidationComment(validationResult);
    await github.createComment(parseInt(issueNumber), validationComment);

    // Update labels based on validation
    if (!validationResult.success) {
      await github.addLabels(parseInt(issueNumber), [
        'status: validation failing',
      ]);
      logger.info('❌ Validation failed, stopping workflow initialization');
      return;
    }

    await github.removeLabel(
      parseInt(issueNumber),
      'status: validation failing',
    );
    await github.addLabels(parseInt(issueNumber), ['status: in progress']);

    // Initialize workflow
    logger.info(`🎬 Initializing ${workflowType} workflow`);
    await orchestrator.initializeWorkflow(
      parseInt(issueNumber),
      sgidDeprecationWorkflow,
      data,
    );

    logger.info('✅ Workflow initialized successfully');
  }
  ```

**Checkpoint**: Can process new deprecation issues, initialize workflow, create first stage tasks.

---

### Week 4: Grace Period & Testing

**Goal**: Add grace period automation and comprehensive testing.

#### Day 15-16: Grace Period Manager

- [ ] T045-T048: Create `src/services/grace-period-manager.ts`

  ```typescript
  export class GracePeriodManager {
    constructor(
      private stateManager: StateManager,
      private orchestrator: WorkflowOrchestrator,
      private github: GitHubService,
    ) {}

    async checkExpiredGracePeriods(): Promise<void> {
      // Find issues with 'status: paused-grace-period' label
      const pausedIssues = await this.github.searchIssues(
        'is:open label:"status: paused-grace-period"',
      );

      for (const issue of pausedIssues) {
        const state = await this.stateManager.loadState(issue.number);
        if (!state) continue;

        // Check if grace period expired
        const currentStage = state.stages[state.currentStage];
        const gracePeriodEnd = this.calculateGracePeriodEnd(
          currentStage.startedAt!,
          30, // days
        );

        if (new Date() >= gracePeriodEnd) {
          await this.resumeWorkflow(state);
        }
      }
    }

    private async resumeWorkflow(state: WorkflowState): Promise<void> {
      // Remove pause label
      await this.github.removeLabel(
        state.issueNumber,
        'status: paused-grace-period',
      );

      // Trigger grace_period_expired transition
      state.status = WorkflowStatus.ACTIVE;
      await this.stateManager.saveState(state);

      await this.orchestrator.handleGracePeriodExpired(state.issueNumber);
    }
  }
  ```

- [ ] T047: Update `.github/workflows/issues.yml` to add scheduled trigger:

  ```yaml
  on:
    issues:
      types: [opened, edited]
    issue_comment:
      types: [created]
    schedule:
      - cron: '0 0 * * *' # Daily at midnight UTC
    workflow_dispatch:
      # ... existing
  ```

- [ ] Add grace period check to `main.ts`:

  ```typescript
  // In run() function, detect event type
  const eventName = process.env.GITHUB_EVENT_NAME;

  if (eventName === 'schedule') {
    const gracePeriodManager = new GracePeriodManager(
      stateManager,
      orchestrator,
      github,
    );
    await gracePeriodManager.checkExpiredGracePeriods();
    return;
  }
  ```

---

#### Day 17-18: Handle Issue Comments (Task Completions)

- [ ] Detect when task issues are closed:
  ```typescript
  // In main.ts, add issue_comment handler
  if (eventName === 'issue_comment' || eventName === 'issues') {
    // Check if this is a task issue being closed
    const taskIssueNumber = await this.detectTaskIssue(issueNumber, issueBody);
    if (taskIssueNumber) {
      // Find parent issue from label "parent: #123"
      const parentIssue = await this.findParentIssue(issueNumber);
      if (parentIssue) {
        await orchestrator.handleTaskCompleted(parentIssue, issueNumber);
      }
    }
  }
  ```

**Checkpoint**: Full workflow automation working - tasks → transitions → grace period → completion.

---

#### Day 19-21: Testing & Documentation

- [ ] Write integration tests:

  ```typescript
  // test/integration/workflow-orchestrator.test.ts
  test('full deprecation workflow', async (t) => {
    // Mock GitHub, services
    // Initialize workflow
    // Simulate task completions
    // Assert state transitions
    // Verify final state
  });
  ```

- [ ] Update README with architecture diagram
- [ ] Document workflow configuration format
- [ ] Add troubleshooting guide
- [ ] Test in real repository with test issues

---

## Success Criteria

✅ **MVP Complete When**:

1. Can create SGID deprecation issue → Automated validation comment posted
2. Validation passes → Workflow initialized, stage 1 tasks created
3. Close stage 1 task → Stage 2 begins, new task assigned
4. Complete all pre-grace tasks → 30-day grace period starts, label added
5. Wait 30 days (or manually advance) → Grace period expires, next stage starts
6. Complete all removal tasks → Workflow marked complete, parent issue closed
7. All state tracked in JSON comment (can manually edit for overrides)

---

## What You Keep From Current Implementation

✅ **Don't throw away your work!** These stay:

- Validation logic (just extract from schema.ts)
- External service integrations (wrap in adapters)
- Issue parsing (move to service)
- Tests (refactor to use new structure)
- GitHub workflow (already perfect!)

---

## What Changes

❌ **Architectural changes only**:

- Extract code into modules (better testability)
- Add state machine (enable multi-stage workflows)
- Add orchestrator (manage transitions)
- Add task creation (child issues)
- Add grace period (scheduled checks)

---

## Dependencies

**Install** (for modular architecture):

```bash
# No new dependencies needed! Your stack is already complete:
# - @octokit/rest ✅
# - ky ✅
# - zod ✅
# - pg ✅
# - google-spreadsheet ✅
# - ava ✅
```

**Optional** (can defer):

```bash
# For better logging in GitHub Actions
pnpm add @actions/core @actions/github

# For bundling (only if you eventually want action.yml)
pnpm add -D @vercel/ncc
```

---

## Risk Mitigation

**Risks**:

1. ⚠️ Big refactor might break existing tests
   - **Mitigation**: Refactor incrementally, keep tests passing at each step
2. ⚠️ State management complexity
   - **Mitigation**: Start with simple state, add complexity gradually
3. ⚠️ Grace period logic might have edge cases
   - **Mitigation**: Add comprehensive tests, use feature flags for overrides

**Fallback Plan**: If refactor takes >2 weeks, pause and ship current validation-only version, then resume refactor.

---

## Next Steps

1. **Review this plan** - Does timeline feel right? Any concerns?
2. **Start Week 1, Day 1** - Create type system
3. **Commit frequently** - One task at a time, keep tests passing
4. **Test as you go** - Don't wait until end to test integration

Ready to start? Let me know and I can help with the first task (T009 - type system).
