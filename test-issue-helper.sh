#!/bin/bash

# Test issue management for SGID deprecation workflow
# Usage:
#   ./test-issue-helper.sh create   - Create a new test issue
#   ./test-issue-helper.sh cleanup  - Close all test issues
#   ./test-issue-helper.sh status   - Show recent workflow runs

set -e

REPO="${GITHUB_REPOSITORY:-steveoh/issue-ops}"

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

# Function to create test issue
create_issue() {
  echo "🧪 Creating Test Deprecation Issue"
  echo "===================================="
  echo "Repository: $REPO"
  echo ""
  
  # Generate unique title with timestamp
  TIMESTAMP=$(date +%Y%m%d-%H%M%S)
  TITLE="[TEST] Remove Utah Test Dataset ($TIMESTAMP)"
  
  read -r -d '' BODY << 'EOF' || true
### Display Name

Utah Test Dataset

### Reasons for Deprecation

**This is a test issue for automated workflow testing.**

Testing the SGID deprecation workflow to verify:
- Issue template parsing and field extraction
- Schema validation (with graceful handling of validation errors)
- Workflow type detection and initialization
- Task issue creation with variable interpolation
- Proper assignee handling

This issue can be safely closed after testing.

### Migration Guide

This is test data only - no migration needed.

For demonstration purposes, this guide would normally include:
- Links to replacement datasets
- Migration instructions
- API endpoint updates
- Contact information

### Internal SGID Table

cadastre.TestDataset

### Open SGID Table

boundaries.test_dataset

### ArcGIS Online Item Id

0df199cef1704e5287ae675ee3dbd3bd

### SGID on ArcGIS URL

https://opendata.gis.utah.gov/datasets/utah-test-dataset/about

### Product Page URL

https://gis.utah.gov/products/sgid/boundaries/test-dataset

### SGID Index Id

550e8400-e29b-41d4-a716-446655440000

### Source

- [x] Manual
- [ ] Farm from AGOL
- [ ] Other

### Historic Relevance

No

### Archives Record Series

_No response_
EOF

  echo "Creating issue..."
  ISSUE_URL=$(gh issue create \
    --repo "$REPO" \
    --title "$TITLE" \
    --body "$BODY" \
    --label "deprecation,porter,test" \
    --assignee "@me")
  
  ISSUE_NUMBER=$(echo "$ISSUE_URL" | grep -oE '[0-9]+$')
  
  echo ""
  echo "✅ Test issue created: #$ISSUE_NUMBER"
  echo "🔗 URL: $ISSUE_URL"
  echo ""
  echo "⏳ Waiting 5 seconds for GitHub Actions to start..."
  sleep 5
  echo ""
  echo "📊 Checking workflow status..."
  gh run list --repo "$REPO" --limit 3
  echo ""
  echo "💡 Next steps:"
  echo "   Watch logs:  gh run view --repo $REPO --log"
  echo "   View issue:  gh issue view $ISSUE_NUMBER --repo $REPO --web"
  echo "   Cleanup:     ./test-issue-helper.sh cleanup"
}

# Function to cleanup test issues
cleanup_issues() {
  echo "🧹 Cleaning up test issues..."
  echo ""
  
  # Find all open test issues
  TEST_ISSUES=$(gh issue list \
    --repo "$REPO" \
    --label "test" \
    --state open \
    --json number,title \
    --jq '.[] | "\(.number)|\(.title)"')
  
  if [ -z "$TEST_ISSUES" ]; then
    echo "✅ No test issues found to clean up"
    return
  fi
  
  echo "Found test issues:"
  echo "$TEST_ISSUES" | while IFS='|' read -r num title; do
    echo "  #$num: $title"
  done
  echo ""
  
  read -p "Close all test issues? (y/N) " -n 1 -r
  echo ""
  
  if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "$TEST_ISSUES" | while IFS='|' read -r num title; do
      echo "Closing #$num..."
      gh issue close "$num" \
        --repo "$REPO" \
        --comment "🧹 Test complete - closing test issue"
    done
    echo ""
    echo "✅ Test issues closed"
  else
    echo "❌ Cleanup cancelled"
  fi
}

# Function to show workflow status
show_status() {
  echo "📊 Recent Workflow Runs"
  echo "======================"
  echo ""
  gh run list --repo "$REPO" --limit 10
  echo ""
  echo "💡 View logs: gh run view <run-id> --repo $REPO --log"
}

# Main command dispatch
case "${1:-}" in
  create)
    create_issue
    ;;
  cleanup)
    cleanup_issues
    ;;
  status)
    show_status
    ;;
  *)
    echo "Test Issue Helper for SGID Deprecation Workflow"
    echo ""
    echo "Usage: $0 <command>"
    echo ""
    echo "Commands:"
    echo "  create   - Create a new test issue (triggers GitHub Actions)"
    echo "  cleanup  - Close all test issues with 'test' label"
    echo "  status   - Show recent GitHub Actions workflow runs"
    echo ""
    echo "Examples:"
    echo "  $0 create"
    echo "  $0 status"
    echo "  $0 cleanup"
    echo ""
    echo "Environment:"
    echo "  GITHUB_REPOSITORY - Target repo (default: steveoh/issue-ops)"
    echo ""
    exit 1
    ;;
esac
