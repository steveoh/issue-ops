#!/bin/bash

# Test script for SGID deprecation workflow
# This simulates a new issue being opened with the deprecation template

# Try to get token from gh CLI if not already set
if [ -z "$GITHUB_TOKEN" ]; then
  if command -v gh &> /dev/null; then
    echo "🔑 No GITHUB_TOKEN set, trying to use gh CLI token..."
    GITHUB_TOKEN=$(gh auth token 2>/dev/null)
    export GITHUB_TOKEN

    if [ -z "$GITHUB_TOKEN" ]; then
      echo "❌ Error: Could not get token from gh CLI"
      echo ""
      echo "Please authenticate with gh CLI first:"
      echo "  gh auth login"
      echo ""
      echo "Or set GITHUB_TOKEN manually:"
      echo "  export GITHUB_TOKEN=\"ghp_your_token_here\""
      echo ""
      exit 1
    fi
    echo "✅ Using token from gh CLI"
  else
    echo "❌ Error: GITHUB_TOKEN not set and gh CLI not found"
    echo ""
    echo "Option 1: Install and use gh CLI:"
    echo "  brew install gh"
    echo "  gh auth login"
    echo ""
    echo "Option 2: Set token manually:"
    echo "  export GITHUB_TOKEN=\"ghp_your_token_here\""
    echo ""
    exit 1
  fi
fi

# Set up environment variables (use defaults if not already set from .env)
export GITHUB_REPOSITORY="${GITHUB_REPOSITORY:-steveoh/issue-ops}"
export ISSUE_NUMBER="${ISSUE_NUMBER:-5}"
export ISSUE_TITLE="${ISSUE_TITLE:-Remove Utah Test Layer from the SGID}"
export ISSUE_ACTION="${ISSUE_ACTION:-opened}"

# Mock issue body with deprecation template data
export ISSUE_BODY='### Display Name

Utah Test Layer

### Reasons for Deprecation

This is a test layer that is no longer needed. Data is outdated and superseded by newer dataset.

### Migration Guide

Use the new dataset at schema.new_table_name instead.

### Internal SGID Table

cadastre.TestLayer

### Open SGID Table

boundaries.test_layer

### ArcGIS Online Item Id

0df199cef1704e5287ae675ee3dbd3bd

### SGID on ArcGIS URL

https://opendata.gis.utah.gov/datasets/utah-test-layer/about

### Product Page URL

https://gis.utah.gov/products/sgid/boundaries/test-layer

### SGID Index Id

550e8400-e29b-41d4-a716-446655440000

### Source

- [x] Manual
- [ ] Farm from AGOL
- [ ] Other

### Historic Relevance

No

### Archives Record Series

_No response_'

echo "🧪 Testing SGID Deprecation Workflow"
echo "======================================"
echo ""
echo "Repository: $GITHUB_REPOSITORY"
echo "Issue: #$ISSUE_NUMBER"
echo "Token: ${GITHUB_TOKEN:0:8}... (${#GITHUB_TOKEN} chars)"
echo ""
echo "⚠️  Note: This will make actual GitHub API calls!"
echo "   Make sure issue #$ISSUE_NUMBER exists in $GITHUB_REPOSITORY"
echo "   or change ISSUE_NUMBER to an existing issue number."
echo ""
echo "Running workflow initialization..."
echo ""

# Run the main script (dotenv loads automatically for local dev)
node lib/src/main.js
