#!/bin/bash

# Master setup script for SGID deprecation workflow testing
# Runs all setup steps in the correct order

set -e

REPO="${GITHUB_REPOSITORY:-steveoh/issue-ops}"

echo "🚀 SGID Deprecation Workflow - Complete Setup"
echo "=============================================="
echo ""
echo "Repository: $REPO"
echo ""

# Check prerequisites
echo "📋 Checking prerequisites..."
echo ""

if ! command -v gh &> /dev/null; then
  echo "❌ gh CLI not found"
  echo "   Install: brew install gh"
  exit 1
fi
echo "✅ gh CLI found"

if ! gh auth status &> /dev/null; then
  echo "❌ Not authenticated with GitHub"
  echo "   Run: gh auth login"
  exit 1
fi
echo "✅ GitHub authentication OK"

if ! command -v node &> /dev/null; then
  echo "❌ Node.js not found"
  echo "   Install: brew install node"
  exit 1
fi
echo "✅ Node.js found"

if [ ! -f "lib/src/main.js" ]; then
  echo "❌ Compiled code not found"
  echo "   Run: npm run build"
  exit 1
fi
echo "✅ Compiled code found"

echo ""
echo "═══════════════════════════════════════════════"
echo ""

# Step 1: Setup labels
echo "Step 1: Creating GitHub labels"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
./setup-labels.sh
echo ""
echo "═══════════════════════════════════════════════"
echo ""

# Step 2: Create test issue
echo "Step 2: Creating test issue"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
read -p "Create a test issue now? (Y/n) " -n 1 -r
echo ""
if [[ ! $REPLY =~ ^[Nn]$ ]]; then
  ./create-test-issue.sh
else
  echo "⏭️  Skipped test issue creation"
  echo ""
  echo "💡 Create manually later with:"
  echo "   ./create-test-issue.sh"
  echo "   or"
  echo "   ./test-issue-helper.sh create"
fi

echo ""
echo "═══════════════════════════════════════════════"
echo ""
echo "✅ Setup complete!"
echo ""
echo "🎯 Next steps:"
echo ""
echo "  Monitor workflow:"
echo "    gh run list --repo $REPO"
echo "    gh run view --repo $REPO --log"
echo ""
echo "  View issues:"
echo "    gh issue list --repo $REPO --label deprecation"
echo ""
echo "  Create more test issues:"
echo "    ./test-issue-helper.sh create"
echo ""
echo "  Cleanup test issues:"
echo "    ./test-issue-helper.sh cleanup"
echo ""
echo "  Check workflow status:"
echo "    ./test-issue-helper.sh status"
echo ""
