# Conductor - SGID Workflow Automation

Automated multi-stage workflows using GitHub issues as the orchestration layer.

## Quick Start

### Setup (One-Time)

1. **Copy the environment template:**

```bash
cp .env.example .env
```

1. **Edit `.env` and set your values:**

   ```bash
   GITHUB_REPOSITORY=steveoh/issue-ops
   ISSUE_NUMBER=5
   OPEN_SGID_PASSWORD=...
   ```

1. **Authenticate with gh CLI (for GitHub token):**

   ```bash
   gh auth login
   ```

1. **(Optional) Authenticate with Google Cloud:**

   For SGID Index validation via Google Sheets:

   ```bash
   gcloud auth application-default login
   ```

   _Skip this if you don't need validation - workflow will show warnings but continue._

### Test Without GitHub (Recommended First Step)

```bash
node test-offline.js
```

This tests parsing, workflow detection, and task generation without any API calls.

### Test With GitHub API

If you're already authenticated with `gh` CLI:

```bash
./test-workflow.sh
```

Or authenticate first:

```bash
gh auth login
./test-workflow.sh
```

### What You'll See

**Offline test shows:**

- ✅ Template parsing (all 10+ fields)
- ✅ Workflow detection (SGID deprecation)
- ✅ Task generation (8 tasks for soft-delete phase)
- ✅ Variable interpolation ({{layerName}} → Utah Test Layer)

**Online test requires:**

- GitHub authentication (via `gh` CLI or `GITHUB_TOKEN`)
- Repository access (default: `agrc/porter`)
- An existing issue number (default: #999)

## Current Status

### ✅ Implemented

- Complete SGID deprecation workflow (5 phases, 25 tasks)
- Template parsing and validation
- Workflow state management (JSON in issue comments)
- Task creation with variable interpolation
- Stage transitions based on events
- 133 tests passing, 73% coverage

### 🔄 Future Work

- Task completion detection (webhook)
- Automatic stage transitions
- Grace period countdown (14 days)
- Weekly nagging (Monday mornings)
- Complaint detection (🙁 emoji)
- Approval mechanisms (👍 counting)

## Documentation

- **[WORKFLOW_INTEGRATION.md](WORKFLOW_INTEGRATION.md)** - Complete technical documentation

## Architecture

```text
Issue Opened (deprecation label)
    ↓
Validation (automatic)
    ↓
Initialize Workflow State
    ↓
Transition to Soft Delete Stage
    ↓
Create 8 Task Issues
    ↓
[Wait for tasks to be completed]
    ↓
Continue through remaining stages...
```

### Key Files

- **`src/workflows/sgid-deprecation.ts`** - Workflow definition (942 lines)
- **`src/main.ts`** - Entry point and orchestration
- **`src/services/workflow-orchestrator.ts`** - State machine
- **`src/services/task-manager.ts`** - Task creation and tracking
- **`src/services/state-manager.ts`** - Persistence layer

## Development

### Build

```bash
npm run build
```

### Test

```bash
npm test  # Run all 133 tests
```

### Lint

```bash
npm run lint
```

## Workflow Phases

1. **Validation** - Verify issue data (automatic)
2. **Soft Delete** - Update metadata, unshare (8 tasks)
3. **Validation + Grace Period** - Verify changes, 14-day pause (5 tasks)
4. **Hard Delete** - Drop tables, delete items (8 tasks)
5. **Final Validation** - Verify deletion complete (4 tasks)

## Field Mapping

Template fields are automatically mapped to task variables:

| Issue Template Field  | Task Variable           | Example                  |
| --------------------- | ----------------------- | ------------------------ |
| Display Name          | `{{layerName}}`         | Utah Test Layer          |
| ArcGIS Online Item Id | `{{agolItemId}}`        | 0df199ce...              |
| Internal SGID Table   | `{{internalSgidTable}}` | cadastre.TestLayer       |
| Open SGID Table       | `{{openSgidTable}}`     | boundaries.test_layer    |
| Product Page URL      | `{{productPageUrl}}`    | https://gis.utah.gov/... |
| SGID Index Id         | `{{sgidIndexId}}`       | 550e8400-...             |
| Deprecation Reason    | `{{reason}}`            | Data is outdated...      |
| Migration Guide       | `{{migrationGuide}}`    | Use new dataset...       |

## Contributing

This is currently in development. See the documentation files for implementation details and future work.

## License

[Add license information]
