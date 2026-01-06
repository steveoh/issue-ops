# Testing Scripts for SGID Deprecation Workflow

## Quick Start

### One-Command Setup and Test

```bash
./setup-workflow-test.sh
```

This will:
1. Check prerequisites (gh CLI, authentication, build)
2. Create all required GitHub labels
3. Optionally create a test issue
4. Show next steps

## Individual Scripts

### 1. setup-labels.sh

Creates all required labels in your GitHub repository.

**Usage:**
```bash
./setup-labels.sh
```

**Creates:**
- **Workflow labels**: `deprecation`, `porter`
- **State labels**: `state: soft delete`, `state: soft delete validation`, `state: hard delete`, `state: hard delete validation`
- **Status labels**: `status: waiting`, `status: blocked`, `status: in progress`, `status: completed`
- **Type labels**: `type: full deprecation`, `type: internal/open sgid deprecation`, `type: full circle deprecation`
- **Discovery labels**: `status: discovery ok`, `status: discovery failing`
- **Other labels**: `task`, `test`

**Note:** Uses `--force` flag to update existing labels, so safe to run multiple times.

---

### 2. create-test-issue.sh

Creates a single test issue with all required fields populated.

**Usage:**
```bash
./create-test-issue.sh
```

**What it does:**
- Creates issue with deprecation template
- Adds labels: `deprecation`, `porter`, `test`
- Assigns to you (`@me`)
- Shows GitHub Actions status
- Provides commands to monitor workflow

**Note:** Checks if labels exist first, prompts to run `setup-labels.sh` if missing.

---

### 3. test-issue-helper.sh

Multi-purpose tool for managing test issues.

**Usage:**
```bash
./test-issue-helper.sh <command>
```

**Commands:**

#### create
Create a new test issue with timestamp in title.
```bash
./test-issue-helper.sh create
```
- Includes timestamp to avoid title conflicts
- Waits 5 seconds and shows workflow status
- Shows monitoring commands

#### cleanup
Close all test issues (with `test` label).
```bash
./test-issue-helper.sh cleanup
```
- Lists all open test issues
- Prompts for confirmation
- Closes with comment "Test complete"

#### status
Show recent GitHub Actions workflow runs.
```bash
./test-issue-helper.sh status
```
- Lists last 10 workflow runs
- Shows run status, conclusion, timing
- Provides command to view logs

---

### 4. setup-workflow-test.sh

Master setup script - runs everything in order.

**Usage:**
```bash
./setup-workflow-test.sh
```

**Steps:**
1. ✅ Check prerequisites (gh, auth, build)
2. 🏷️ Create labels (`setup-labels.sh`)
3. 🧪 Create test issue (optional)
4. 📋 Show next steps

---

## Environment Variables

All scripts support:

```bash
export GITHUB_REPOSITORY="owner/repo"
```

Default: `steveoh/issue-ops`

## Prerequisites

1. **gh CLI** - GitHub command line tool
   ```bash
   brew install gh
   gh auth login
   ```

2. **Node.js** - For running the workflow code
   ```bash
   brew install node
   ```

3. **Built code** - Compiled TypeScript
   ```bash
   npm run build
   ```

## Workflow Testing Process

### First Time Setup

```bash
# 1. Build the code
npm run build

# 2. Run complete setup
./setup-workflow-test.sh

# 3. Monitor the workflow
gh run list --repo steveoh/issue-ops
gh run view --repo steveoh/issue-ops --log
```

### Subsequent Tests

```bash
# Create test issue
./test-issue-helper.sh create

# Check status
./test-issue-helper.sh status

# View logs
gh run view --repo steveoh/issue-ops --log

# Cleanup when done
./test-issue-helper.sh cleanup
```

## What to Verify

After creating a test issue, check:

### 1. GitHub Actions Workflow
```bash
gh run list --repo steveoh/issue-ops
```
- ✅ Workflow triggered
- ✅ No errors in logs

### 2. Issue Comments
```bash
gh issue view <number> --repo steveoh/issue-ops
```
- ✅ Validation comment posted
- ✅ Workflow state comment created
- ✅ Shows "Stage: Soft Delete"

### 3. Task Issues Created
```bash
gh issue list --repo steveoh/issue-ops --label task
```
- ✅ 8 task issues created
- ✅ Titles have interpolated variables (not {{layerName}})
- ✅ Task bodies have proper content
- ✅ Links back to parent issue work

### 4. Labels Applied
```bash
gh issue view <number> --repo steveoh/issue-ops --json labels
```
- ✅ `state: soft delete` label added
- ✅ `status: in progress` label added (if applicable)

## Troubleshooting

### "Label not found"
```bash
./setup-labels.sh
```

### "Not authenticated"
```bash
gh auth login
```

### "Compiled code not found"
```bash
npm run build
```

### "Workflow didn't trigger"
- Check if issue has `deprecation` label
- Check GitHub Actions permissions
- View workflow file: `.github/workflows/issue-ops.yml`

### "No tasks created"
- Check GitHub Actions logs
- Look for errors in workflow execution
- Verify validation passed

## Cleanup

Remove all test issues:
```bash
./test-issue-helper.sh cleanup
```

Remove labels (if needed):
```bash
gh label delete "test" --repo steveoh/issue-ops --yes
# Repeat for other labels
```

## Examples

### Quick Test Cycle
```bash
# Create and test
./test-issue-helper.sh create

# Wait ~10 seconds, then check
./test-issue-helper.sh status

# View specific run
gh run view 123456 --repo steveoh/issue-ops --log

# All good? Clean up
./test-issue-helper.sh cleanup
```

### Debug Failed Workflow
```bash
# See what failed
gh run list --repo steveoh/issue-ops

# Get logs
gh run view --log --repo steveoh/issue-ops

# View the issue
gh issue view <number> --repo steveoh/issue-ops
```

## Tips

- **Use timestamps**: `test-issue-helper.sh create` adds timestamps to avoid conflicts
- **Test label**: All test issues get `test` label for easy cleanup
- **Safe labels**: `setup-labels.sh` uses `--force` so safe to re-run
- **Environment**: Set `GITHUB_REPOSITORY` to test in different repos

## Script Dependencies

```
setup-workflow-test.sh
  ├── setup-labels.sh
  └── create-test-issue.sh

test-issue-helper.sh
  └── (standalone)
```

All scripts are independent except `setup-workflow-test.sh` which orchestrates others.
