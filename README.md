# Issue Operations

GitHub issue operations and automation tools for SGID data management.

## Overview

This repository contains tools and workflows for managing GitHub issues related to SGID (Statewide Geographic Information Database) operations, including deprecation workflows and automation scripts.

## Automated Issue Processing

### GitHub Actions Workflow

The repository includes a GitHub Action workflow (`.github/workflows/install-script.yml`) that automatically processes issues:

- **Triggers on issue creation**: Automatically runs when new issues are opened
- **Manual trigger**: Can be manually triggered for specific issue numbers
- **Issue parsing**: Extracts structured data from issue templates
- **Deprecation handling**: Special processing for SGID deprecation requests

#### How it Works

1. **Automatic Trigger**: When someone creates a new issue, the workflow automatically runs
2. **Issue Analysis**: The script analyzes the issue title and content
3. **Template Parsing**: If the issue uses a structured template, it extracts the data
4. **Processing Logic**: Runs appropriate processing based on issue type (deprecation vs. general)
5. **Logging**: Provides detailed logs of the processing steps

#### Manual Trigger

You can also manually trigger the workflow for existing issues:
1. Go to the "Actions" tab in your GitHub repository
2. Select "Process Issues" workflow
3. Click "Run workflow"
4. Enter the issue number you want to process

### Processing Logic

The script (`scripts/install.js`) includes:

- **Deprecation Issue Detection**: Automatically detects deprecation issues by keywords
- **Template Parsing**: Extracts structured data from GitHub issue templates
- **Environment Variables**: Receives issue data through GitHub Actions environment variables
- **Extensible Processing**: Easy to add new processing logic for different issue types

## Files Structure

```
issue-ops/
├── .github/
│   ├── ISSUE_TEMPLATE/
│   │   └── deprecate.yaml          # SGID deprecation issue template
│   └── workflows/
│       └── install-script.yml      # Issue processing workflow
├── scripts/
│   └── install.js                  # Main issue processing script
├── package.json                    # Node.js project configuration
└── README.md                       # This file
```

## Local Development

### Requirements

- Node.js 16 or higher
- npm

### Running Locally

```bash
# Install dependencies
npm install

# Make script executable
chmod +x scripts/install.js

# Test the script (without issue data)
npm run process-issue
# or
node scripts/install.js
```

### Testing with Issue Data

You can test the script locally by setting environment variables:

```bash
# Test with sample issue data
ISSUE_NUMBER=123 \
ISSUE_TITLE="Remove Utah Avalanche Paths from the SGID" \
ISSUE_BODY="### Display Name\nUtah Avalanche Paths\n\n### Reasons for Deprecation\nData is outdated" \
node scripts/install.js
```

### Contributing

1. Create a feature branch
2. Make your changes
3. Test locally with sample issue data
4. Submit a pull request

The GitHub Action will automatically process new issues when they are created.

## Issue Templates

The repository includes issue templates for:

- **SGID Deprecation** (`deprecate.yaml`): For managing the deprecation of SGID datasets

## License

MIT
