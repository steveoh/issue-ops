# Implementation Plan: GitHub Issue Operations Management

**Branch**: `001-github-issue-ops` | **Date**: 2025-12-31 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/001-github-issue-ops/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

Build a GitHub Action that automates change management for SGID data layers, applications, and Open SGID through issue-based workflows. The system detects issue templates, orchestrates multi-stage processes via automated comments and task assignments, and provides transparent progress tracking. Action plan state is stored in hidden JSON-encoded GitHub comments to enable manual manipulation and feature flags.

## Technical Context

**Language/Version**: TypeScript (latest stable with strict mode)  
**Primary Dependencies**: @octokit/rest (GitHub API), @esri/arcgis-rest-portal (ArcGIS integration), google-spreadsheet (Sheets inspection), pg (PostgreSQL), ky (HTTP client)  
**Storage**: Firestore (free tier) for persistent state, GitHub comments for action plan state (JSON-encoded, hidden)  
**Testing**: AVA test framework with c8 coverage  
**Target Platform**: GitHub Actions runner (Node.js environment)
**Project Type**: Single project (GitHub Action)  
**Performance Goals**: Action completes in <30 seconds for issue creation events, <10 seconds for comment/assignment events  
**Constraints**: Minimal dependencies for fast cold starts, stateless execution per workflow run, GitHub API rate limit management  
**Scale/Scope**: Support 50+ concurrent active issues, 5 distinct workflow types (SGID add/deprecate, app add/deprecate, internal SGID deprecate)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Verify compliance with `.specify/memory/constitution.md`:

- [x] **Code Quality & Type Safety**: TypeScript strict mode enabled, all types explicit, no `any` without justification
- [x] **Testing Standards**: Tests planned (unit/integration/contract), >80% coverage target for new code
- [x] **User Experience Consistency**: CLI outputs defined (stdout for data, stderr for errors, actionable messages)
- [x] **Performance Requirements**: Retry logic for APIs, connection pooling for DB, <1s startup, progress for long operations
- [x] **Quality Gates**: Passes type checking, linting, formatting, testing, and build requirements
- [x] **Complexity Justification**: GitHub Action architecture is simple and stateless; Firestore justifies need for persistent state across workflow runs

*All principles met. GitHub Action pattern with stateless execution per run aligns with constitution goals.*

## Project Structure

### Documentation (this feature)

```text
specs/[###-feature]/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
src/
├── models/              # Domain entities (Issue, Workflow, Stage, Task, Assignment)
├── services/            # Business logic (WorkflowOrchestrator, TemplateDetector, StateManager)
├── adapters/            # External integrations (GitHub, Firestore, ArcGIS, Sheets, PostgreSQL)
├── workflows/           # Workflow definitions for each issue type (SGID add/deprecate, app add/deprecate, internal)
└── main.ts              # Action entry point

test/
├── unit/                # Isolated logic tests
├── integration/         # Component interaction tests
└── contract/            # External API boundary tests (mocked)

.github/
├── workflows/           # GitHub Action workflow files
└── ISSUE_TEMPLATE/      # Issue templates for SGID, applications, etc.
```

**Structure Decision**: Single project structure (Option 1) as this is a standalone GitHub Action. All source code in `src/` with clear separation of concerns: models for entities, services for orchestration logic, adapters for external systems, and workflows for declarative workflow definitions.

## Complexity Tracking

No violations. Constitution principles are met with the proposed architecture.

---

## Phase Completion Status

### Phase 0: Research & Planning ✅

**Completed**: 2025-12-31

**Artifacts Generated**:
- `research.md` - Technology decisions, patterns, and integration strategies documented

**Key Decisions**:
- GitHub Actions event-driven architecture with stateless execution
- JSON state in HTML comments for manual intervention support
- Adapter pattern for external integrations (ArcGIS, Sheets, PostgreSQL)
- AVA testing with unit/integration/contract test tiers
- Exponential backoff retry logic for GitHub API rate limits

### Phase 1: Design & Contracts ✅

**Completed**: 2025-12-31

**Artifacts Generated**:
- `data-model.md` - Complete entity definitions, relationships, and state transitions
- `contracts/service-interfaces.ts` - TypeScript service interface contracts
- `contracts/state-schema.json` - JSON schema for WorkflowState validation
- `contracts/workflow-definitions.ts` - Workflow configuration structure
- `quickstart.md` - Setup and development guide
- `.github/agents/copilot-instructions.md` - Updated with TypeScript, dependencies, and project context

**Design Validation**:
- ✅ All 5 workflow types defined (SGID add/deprecate, app add/deprecate, internal SGID deprecate)
- ✅ State machine pattern with explicit stage transitions
- ✅ Task assignment via child GitHub issues
- ✅ Grace period support for deprecation workflows
- ✅ Feature flags for manual intervention
- ✅ Audit trail via StageTransition history

**Constitution Re-Check**: ✅ All principles remain satisfied after design phase

### Phase 2: Implementation Tasks (Next Step)

**Status**: Not Started - command ends at Phase 1 per instructions

**Next Command**: `/speckit.tasks` to generate `tasks.md` with implementation checklist

**Expected Task Categories**:
1. Core infrastructure (StateManager, WorkflowOrchestrator, TemplateDetector)
2. Workflow definitions (5 workflow types with stage definitions)
3. Service adapters (GitHub, Firestore, ArcGIS, Sheets, PostgreSQL)
4. Issue templates (.github/ISSUE_TEMPLATE/*.yml)
5. GitHub Action workflow (.github/workflows/issue-ops.yml)
6. Test suite (unit/integration/contract tests)
7. Documentation and deployment

---

## Summary

**Branch**: `001-github-issue-ops`  
**Implementation Plan**: `/Users/steve/dev/clones/issue-ops/specs/001-github-issue-ops/plan.md`

**Generated Artifacts**:
- ✅ `research.md` - Technology research and architectural decisions
- ✅ `data-model.md` - Complete domain model with entities and state transitions
- ✅ `contracts/` - TypeScript interfaces and JSON schemas
- ✅ `quickstart.md` - Developer setup guide
- ✅ Updated Copilot agent context

**Constitution Status**: ✅ All principles satisfied (no violations)

**Next Action**: Run `/speckit.tasks` to generate Phase 2 implementation task breakdown.
