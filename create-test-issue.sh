#!/bin/bash

# Script to create a test deprecation issue for GitHub Actions testing
# This creates a real issue that will trigger the workflow automation

set -e  # Exit on error

# Configuration
REPO="${GITHUB_REPOSITORY:-steveoh/issue-ops}"
TITLE="Remove Utah County Boundaries Dataset from the SGID"

# Check if gh CLI is available
if ! command -v gh &> /dev/null; then
  echo "❌ Error: gh CLI not found"
  echo "Install with: brew install gh"
  exit 1
fi

# Check authentication
if ! gh auth status &> /dev/null; then
  echo "❌ Error: Not authenticated with GitHub"
  echo "Run: gh auth login"
  exit 1
fi

echo "🧪 Creating Test Deprecation Issue"
echo "===================================="
echo ""
echo "Repository: $REPO"
echo "Title: $TITLE"
echo ""
echo "💡 First time? Run ./setup-labels.sh to create required labels"
echo ""

# Create issue body matching the deprecation template
# This matches the exact format GitHub creates from the YAML template
read -r -d '' ISSUE_BODY << 'EOF' || true
### Display Name

Utah County Boundaries

### Reasons for Deprecation

This is a test dataset created for automated workflow testing. The data was used for development purposes only and is no longer needed. This test helps verify that the SGID deprecation workflow correctly:

- Parses issue template fields
- Validates data against schema
- Initializes workflow state
- Creates task issues with proper variable interpolation
- Assigns tasks to appropriate team members

### Migration Guide

This is test data only - no migration needed. For real deprecations, users should refer to the replacement dataset documentation at https://gis.utah.gov/products/sgid/

If this were a real deprecation, the migration guide would include:
- Link to replacement dataset
- Instructions for updating map services
- API endpoint changes
- Contact information for questions

### Internal SGID Table

boundaries.Counties

### Open SGID Table

boundaries.county_boundaries

### ArcGIS Online Item Id

90431cac2f9f49f4bcf1505419583753

### SGID on ArcGIS URL

https://opendata.gis.utah.gov/datasets/utah-county-boundaries/about

### Product Page URL

https://gis.utah.gov/products/sgid/boundaries/county/

### SGID Index Id

b2c8af56-3d92-4aa7-ac2f-b1388051d9ce

### Source

- [x] Manual
- [ ] Farm from AGOL
- [ ] Other

### Historic Relevance

Yes

### Archives Record Series

RS-2024-GIS-001
EOF

echo "📝 Checking if required labels exist..."
echo ""

# Check if labels exist, create them if not
REQUIRED_LABELS=("deprecation" "porter" "test")
for label in "${REQUIRED_LABELS[@]}"; do
  if ! gh label list --repo "$REPO" --search "$label" --json name -q ".[].name" 2>/dev/null | grep -q "^${label}$"; then
    echo "⚠️  Label '$label' not found"
    echo "💡 Run ./setup-labels.sh to create all required labels"
    echo ""
    read -p "Continue without labels? (y/N) " -n 1 -r
    echo ""
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
      echo "❌ Cancelled. Please run ./setup-labels.sh first"
      exit 1
    fi
    USE_LABELS=""
    break
  fi
done

if [ -z "$USE_LABELS" ]; then
  USE_LABELS="--label deprecation,porter,test"
fi

echo "📝 Creating issue with deprecation template..."
echo ""

# Create the issue with proper labels (if they exist)
ISSUE_URL=$(gh issue create \
  --repo "$REPO" \
  --title "$TITLE" \
  --body "$ISSUE_BODY" \
  $USE_LABELS \
  --assignee "@me")

if [ $? -eq 0 ]; then
  echo ""
  echo "✅ Issue created successfully!"
  echo ""
  echo "Issue URL: $ISSUE_URL"
  echo ""

  # Extract issue number from URL
  ISSUE_NUMBER=$(echo "$ISSUE_URL" | grep -oE '[0-9]+$')

  echo "📊 What to check:"
  echo "  1. GitHub Actions workflow should trigger"
  echo "  2. Validation comment should be posted"
  echo "  3. Workflow state comment should appear"
  echo "  4. 8 task issues should be created for soft-delete phase"
  echo ""
  echo "🔍 View issue:"
  echo "  gh issue view $ISSUE_NUMBER --repo $REPO --web"
  echo ""
  echo "📜 Watch workflow logs:"
  echo "  gh run list --repo $REPO --limit 5"
  echo "  gh run view --repo $REPO --log"
  echo ""
  echo "🗑️  Clean up when done:"
  echo "  gh issue close $ISSUE_NUMBER --repo $REPO --comment 'Test complete'"
  echo ""
else
  echo ""
  echo "❌ Failed to create issue"
  exit 1
fi
