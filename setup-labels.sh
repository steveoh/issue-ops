#!/bin/bash

# Script to create all required labels for SGID deprecation workflow
# Creates labels with appropriate colors and descriptions

set -e

REPO="${GITHUB_REPOSITORY:-steveoh/issue-ops}"

# Color scheme
COLOR_STATE="#15803D"        # Tailwind green-600 (state)
COLOR_STATUS="#EA580C"       # Tailwind orange-700 (status)
COLOR_TYPE="#2563EB"         # Tailwind blue-600 (type)
COLOR_WORKFLOW="#6D28D9"     # Tailwind violet-700 (workflow)
COLOR_GENERAL="#E5E7EB"      # Tailwind gray-200 (general)
COLOR_TEST="#FECACA"         # Tailwind rose-200 (test)

echo "🏷️  Creating SGID Deprecation Workflow Labels"
echo "=============================================="
echo ""
echo "Repository: $REPO"
echo ""

# Check gh CLI
if ! command -v gh &> /dev/null; then
  echo "❌ gh CLI not found. Install with: brew install gh"
  exit 1
fi

# Check auth
if ! gh auth status &> /dev/null; then
  echo "❌ Not authenticated. Run: gh auth login"
  exit 1
fi

# Function to create or update label
create_label() {
  local name="$1"
  local description="$2"
  local color="$3"
  
  echo "Creating: $name"
  gh label create "$name" \
    --repo "$REPO" \
    --description "$description" \
    --color "$color" \
    --force 2>&1 | grep -v "already exists" || true
}

echo "📋 Creating workflow labels..."
echo ""

# Workflow identification
create_label "deprecation" \
  "SGID data deprecation workflow" \
  "$COLOR_WORKFLOW"

create_label "porter" \
  "Data management task for porter" \
  "$COLOR_GENERAL"

# State labels (workflow stages)
echo ""
echo "🔄 Creating state labels (workflow stages)..."
echo ""

create_label "state: soft delete" \
  "Phase 2: Updating metadata and hiding data" \
  "$COLOR_STATE"

create_label "state: soft delete validation" \
  "Phase 3: Validating soft delete + 14-day grace period" \
  "$COLOR_STATE"

create_label "state: hard delete" \
  "Phase 4: Permanently removing data from all systems" \
  "$COLOR_STATE"

create_label "state: hard delete validation" \
  "Phase 5: Final verification of deletion" \
  "$COLOR_STATE"

# Status labels (workflow progress)
echo ""
echo "⏱️  Creating status labels (workflow progress)..."
echo ""

create_label "status: waiting" \
  "Paused, waiting for event or grace period" \
  "$COLOR_STATUS"

create_label "status: blocked" \
  "Blocked, needs attention or resolution" \
  "$COLOR_STATUS"

create_label "status: in progress" \
  "Actively working on tasks" \
  "$COLOR_STATUS"

create_label "status: completed" \
  "All tasks completed successfully" \
  "$COLOR_STATUS"

# Type labels (deprecation types)
echo ""
echo "📦 Creating type labels (deprecation scope)..."
echo ""

create_label "type: full deprecation" \
  "Remove from all SGID products (Internal, Open, AGOL, Hub)" \
  "$COLOR_TYPE"

create_label "type: internal/open sgid deprecation" \
  "Remove from SGID databases only (keep AGOL/Hub)" \
  "$COLOR_TYPE"

create_label "type: full circle deprecation" \
  "Full lifecycle: deprecate, archive, then restore manually" \
  "$COLOR_TYPE"

# Discovery status labels (validation)
echo ""
echo "🔍 Creating discovery status labels..."
echo ""

create_label "status: discovery ok" \
  "All validation checks passed" \
  "$COLOR_STATE"

create_label "status: discovery failing" \
  "Validation checks failed or have warnings" \
  "$COLOR_STATUS"

# Task label
echo ""
echo "✅ Creating task label..."
echo ""

create_label "task" \
  "Individual task in workflow" \
  "$COLOR_GENERAL"

# Test label
echo ""
echo "🧪 Creating test label..."
echo ""

create_label "test" \
  "Test issue for workflow development" \
  "$COLOR_TEST"

echo ""
echo "✅ All labels created successfully!"
echo ""
echo "📊 View labels:"
echo "  gh label list --repo $REPO"
echo ""
echo "🧪 Now you can create test issues:"
echo "  ./create-test-issue.sh"
echo "  or"
echo "  ./test-issue-helper.sh create"
echo ""
