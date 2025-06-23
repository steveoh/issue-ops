#!/usr/bin/env node
import { type IGroup, type IItemAdd } from '@esri/arcgis-rest-portal';
import { Octokit } from '@octokit/rest';
import ky from 'ky';
import { markdownTable } from 'markdown-table';
import { z } from 'zod/v4';
import { pgTableExists } from './database.js';
import { validateSgidIndexId } from './sheets.js';
import { log, logError } from './utils.js';

export type ValidationResult = {
  success: boolean;
  errors?: ReturnType<typeof z.flattenError>;
  data?: z.output<typeof IssueDataSchema>;
};

type GroupResult = {
  other: IGroup[];
};

export type IssueDataFields = z.input<typeof IssueDataSchema>;
export type IssueData = z.output<typeof IssueDataSchema> | undefined;

const ISSUE_DATA_FIELDS = [
  'display-name',
  'internal-sgid-table',
  'open-sgid-table',
  'arcgis-online-id',
  'sgid-on-arcgis-url',
  'product-page-url',
  'sgid-index-id',
  'archives-record-series',
];

const IssueDataSchema = z
  .object({
    'display-name': z
      .string('Display name is required')
      .min(6, 'A longer display name is required')
      .regex(
        /^Utah\s\w+(?:\s+\w+)*$/,
        "Display name must start with 'Utah' followed by one or more words",
      ),
    'internal-sgid-table': z
      .string('Internal SGID table is required')
      .regex(
        /^[^.]+\.[^.]+$/,
        'SGID table name must be in the format "schema.table" with a single period',
      ),
    'open-sgid-table': z
      .string()
      .regex(
        /^[^.]+\.[^.]+$/,
        'Open SGID table name must be in the format "schema.table" with a single period',
      )
      .optional(),
    'arcgis-online-id': z
      .string('')
      .regex(/^[0-9a-fA-F]{32}$/, 'Must be a valid UUID v4 without hyphens')
      .optional(),
    'sgid-on-arcgis-url': z
      .url('Must be a valid URL')
      .includes('opendata.gis.utah.gov', {
        error: 'URL must be from opendata.gis.utah.gov',
      })
      .optional(),
    'product-page-url': z
      .url('Must be a valid URL')
      .includes('gis.utah.gov/products/sgid/', {
        error: 'Product pages must be from gis.utah.gov',
      })
      .optional(),
    'sgid-index-id': z.uuidv4('Must be a valid UUID').optional(),
    'archives-record-series': z.string().optional(),
  })
  .transform(async (data) => {
    const discovery = {
      data: [['sgid product', 'data', 'status']],
      warnings: [] as string[],
    };

    const arcgisOnline = {
      data: [['setting', 'value', 'status']],
      warnings: [] as string[],
    };

    if (data['open-sgid-table']) {
      try {
        const [schema, table] = data['open-sgid-table'].split('.');
        const exists = await pgTableExists(schema!, table!);

        discovery.data.push([
          'Open SGID',
          data['open-sgid-table'] || 'Not published',
          exists ? '✅' : '❌',
        ]);

        if (!exists) {
          discovery.warnings.push(
            `Open SGID table "${data['open-sgid-table']}" was not found in the Open SGID database`,
          );
        }
      } catch (error) {
        if (!process.env.NODE_ENV?.includes('test')) {
          logError('Failed to connect to the Open SGID table:', error);
        }

        discovery.data.push(['Open SGID', 'not accessible', '❌']);

        discovery.warnings.push(
          `Failed to validate Open SGID table "${data['open-sgid-table']}": ${error}`,
        );
      }
    }

    if (data['product-page-url']) {
      try {
        await ky.head(data['product-page-url'], { redirect: 'error' });
        discovery.data.push([
          'gis.utah.gov',
          `[product page](${data['product-page-url']})`,
          '✅',
        ]);
      } catch (error) {
        discovery.data.push([
          'gis.utah.gov',
          `[product page](${data['product-page-url']})`,
          '❌',
        ]);

        if (
          error instanceof Error &&
          error.cause &&
          typeof error.cause === 'object' &&
          'message' in error.cause &&
          error.cause.message === 'unexpected redirect'
        ) {
          discovery.warnings.push(
            'Product page URL contains redirects - please use the final destination URL',
          );
        } else if (
          error instanceof Error &&
          error.name === 'HTTPError' &&
          'response' in error &&
          (error as any).response.status === 404
        ) {
          discovery.warnings.push(
            `Product page URL must return a 200 OK status`,
          );
        } else {
          discovery.warnings.push(
            'Failed to validate Product page URL due to a network error',
          );
        }
      }
    }

    if (data['sgid-index-id']) {
      try {
        const row = await validateSgidIndexId(data['sgid-index-id']);

        discovery.data.push([
          'SGID Index',
          row > -1 ? `row ${row}` : '',
          row > -1 ? '✅' : '❌',
        ]);

        if (row === -1) {
          discovery.warnings.push(
            `SGID Index ID "${data['sgid-index-id']}" does not exist in the SGID Index`,
          );
        }
      } catch (error) {
        logError('Failed to validate SGID Index ID:', error);

        discovery.data.push([
          'SGID Index',
          `Invalid SGID Index ID: ${data['sgid-index-id']}`,
          '❌',
        ]);

        discovery.warnings.push(
          `Invalid SGID Index ID: ${data['sgid-index-id']}`,
        );
      }
    }

    if (data['arcgis-online-id']) {
      try {
        const response = await ky.get(
          `https://www.arcgis.com/sharing/rest/content/items/${data['arcgis-online-id']}`,
          {
            searchParams: { f: 'json' },
            redirect: 'error',
          },
        );

        if (response.ok) {
          const itemData = (await response.json()) as IItemAdd;

          if (itemData && itemData.id) {
            arcgisOnline.data.push([
              'ItemId',
              `[${data['arcgis-online-id']}](https://www.arcgis.com/home/item.html?id=${data['arcgis-online-id']}?f=json)`,
              '✅',
            ]);

            arcgisOnline.data.push([
              'Sharing',
              itemData.access,
              itemData.access === 'public' ? '✅' : '❌',
            ]);
          } else {
            arcgisOnline.data.push([
              'ArcGIS Online',
              `[${data['arcgis-online-id']}](https://www.arcgis.com/home/item.html?id=${data['arcgis-online-id']}?f=json)`,
              '❌',
            ]);

            arcgisOnline.warnings.push(`Invalid ArcGIS Online item data`);
          }
        } else {
          logError(`Failed to fetch ArcGIS Online item:`, response);

          arcgisOnline.data.push([
            'ItemId',
            `[${data['arcgis-online-id']}](https://www.arcgis.com/home/item.html?id=${data['arcgis-online-id']}?f=json)`,
            '❌',
          ]);

          arcgisOnline.warnings.push(
            `Failed to fetch ArcGIS Online item: ${response.statusText}`,
          );
        }
      } catch (error) {
        logError('Failed to fetch ArcGIS Online item:', error);

        arcgisOnline.data.push([
          'ItemId',
          `[${data['arcgis-online-id']}](https://www.arcgis.com/home/item.html?id=${data['arcgis-online-id']}?f=json)`,
          '❌',
        ]);

        arcgisOnline.warnings.push(
          `Failed to fetch ArcGIS Online item: ${error}`,
        );
      }

      try {
        const response = await ky.get(
          `https://www.arcgis.com/sharing/rest/content/items/${data['arcgis-online-id']}/groups`,
          {
            searchParams: { f: 'json' },
            redirect: 'error',
          },
        );

        if (response.ok) {
          const groups = (await response.json()) as GroupResult;

          if (groups && groups.other) {
            arcgisOnline.data.push([
              'Groups',
              groups.other
                .filter((group) => group.owner == 'UtahAGRC')
                .map((group) => group.title)
                .join(', '),
              groups.other.length > 0 ? '✅' : '❌',
            ]);
          } else {
            logError('Invalid ArcGIS Online item data');

            arcgisOnline.data.push([
              'Groups',
              `[${data['arcgis-online-id']}](https://www.arcgis.com/sharing/rest/content/items/${data['arcgis-online-id']}/groups?f=json)`,
              '❌',
            ]);

            arcgisOnline.warnings.push(
              'Invalid ArcGIS Online item groups data',
            );
          }
        } else {
          arcgisOnline.data.push([
            'Groups',
            `[${data['arcgis-online-id']}](https://www.arcgis.com/sharing/rest/content/items/${data['arcgis-online-id']}/groups?f=json)`,
            '❌',
          ]);

          logError(
            `Failed to fetch ArcGIS Online item groups: ${response.statusText}`,
          );
        }
      } catch (error) {
        logError('Failed to fetch ArcGIS Online item groups', error);

        arcgisOnline.data.push([
          'Groups',
          `[${data['arcgis-online-id']}](https://www.arcgis.com/sharing/rest/content/items/${data['arcgis-online-id']}/groups?f=json)`,
          '❌',
        ]);

        arcgisOnline.warnings.push('Failed to fetch ArcGIS Online item groups');
      }
    }

    return {
      displayName: data['display-name'],
      discovery,
      arcgisOnline,
    };
  });

log('🚀 Starting issue processing...');

// Get environment variables from GitHub Actions
const issueNumber: string | undefined = process.env.ISSUE_NUMBER;
const issueTitle: string | undefined = process.env.ISSUE_TITLE;
const issueBody: string | undefined = process.env.ISSUE_BODY;
const githubToken: string | undefined = process.env.GITHUB_TOKEN;
const githubRepository: string | undefined = process.env.GITHUB_REPOSITORY;

const octokit = githubToken ? new Octokit({ auth: githubToken }) : null;

export async function run(): Promise<void> {
  try {
    log(`📋 Processing Issue #${issueNumber}`);
    log(`📝 Title: ${issueTitle}`);

    if (!issueNumber) {
      log('ℹ️ No issue data found - running in standalone mode');

      return;
    }

    if (!issueBody) {
      log('✅ Issue processing completed successfully!');

      return;
    }

    const data = parseIssueTemplate(issueBody.split('\n'));

    log('📊 Parsed issue data:', data);
    log('🔍 Starting validation of issue data...');

    const result = await validateAndTransform(data);

    await postIssueComment(result);

    log('✅ Issue data validation passed!');
    log('✅ Issue processing completed successfully!');
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error';
    logError('❌ Issue processing failed:', errorMessage);

    process.exit(1);
  }
}

export function parseIssueTemplate(lines: string[]): IssueDataFields {
  let result: IssueDataFields = {
    'display-name': '',
    'internal-sgid-table': '',
    'open-sgid-table': undefined,
    'arcgis-online-id': undefined,
    'sgid-on-arcgis-url': undefined,
    'product-page-url': undefined,
    'sgid-index-id': undefined,
    'archives-record-series': undefined,
  };

  let currentField: string | null = null;

  for (const line of lines) {
    // Look for field headers in the format "### Field Name"
    const headerMatch = line.match(/^###\s+(.+)$/);
    if (headerMatch) {
      currentField = headerMatch[1]!.toLowerCase().replace(/\s+/g, '-');

      continue;
    }

    // Look for filled-in values (non-empty lines that aren't placeholders)
    if (
      currentField &&
      ISSUE_DATA_FIELDS.includes(currentField) &&
      line.trim() &&
      !line.startsWith('_No response_') &&
      !line.startsWith('<!--') &&
      !line.includes('placeholder')
    ) {
      // Initialize a new object if data is undefined
      const obj = (result ?? {}) as Record<string, string>;
      obj[currentField] = line.trim();
      // Assign back to data
      (result as any) = obj as IssueDataFields;
      currentField = null;
    }
  }

  return result;
}

export async function validateAndTransform(
  data: IssueDataFields,
): Promise<ValidationResult> {
  try {
    const result = await IssueDataSchema.safeParseAsync(data);

    if (result.success) {
      return {
        success: true,
        data: result.data,
      };
    } else {
      return {
        success: false,
        errors: z.flattenError(result.error),
      };
    }
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown validation error';

    return {
      success: false,
      errors: {
        formErrors: [`Validation failed: ${errorMessage}`],
        fieldErrors: {},
      },
    };
  }
}

export function generateCommentBody(
  validationResult: ValidationResult,
): string {
  const validationMarker = `<!-- issue-ops-validation-comment -->`;

  // Determine the main status emoji
  const statusEmoji = validationResult.success ? '✅' : '❌';
  const statusText = validationResult.success
    ? 'Nice work!'
    : 'Validation Failed';
  const statusMessage = validationResult.success
    ? "The deprecation data has been successfully validated! Here's a summary of what I found."
    : 'There were validation errors found.';

  let commentBody = `${validationMarker}\n### ${statusEmoji} ${statusText}\n\n${statusMessage}\n\n`;
  commentBody +=
    '**Please double check these results and edit your original issue until the results match your expectations and there are no errors.**\n\n';

  if (!validationResult.success && validationResult.errors) {
    commentBody += '### Input Validation Errors\n\n';

    // Top level errors
    if (validationResult.errors.formErrors.length > 0) {
      validationResult.errors.formErrors.forEach((error) => {
        commentBody += `- ${error}\n`;
      });

      commentBody += '\n';
    }

    // Handle field-specific errors
    Object.entries(validationResult.errors.fieldErrors ?? {}).forEach(
      ([field, messages]) => {
        if (messages && Array.isArray(messages) && messages.length > 0) {
          messages.forEach((message) => {
            commentBody += `- **${field}**: ${message}\n`;
          });
        }
      },
    );
  } else {
    // Add success validation table

    const data = validationResult.data;
    if (data) {
      // Generate the SGID products table
      if (data.discovery.data.length > 0) {
        commentBody += markdownTable(data?.discovery.data, {
          alignDelimiters: false,
        });
        commentBody += '\n\n';

        if (data?.discovery?.warnings?.length) {
          commentBody += '### SGID Product Warnings\n\n';

          data.discovery.warnings.forEach((warning) => {
            commentBody += `- ${warning}\n`;
          });

          commentBody += '\n';
        }
      }

      // ArcGIS Online section
      if (data.arcgisOnline.data.length > 0) {
        commentBody += '### ArcGIS Online\n\n';

        // Generate the ArcGIS Online table
        commentBody += markdownTable(data.arcgisOnline.data, {
          alignDelimiters: false,
        });
        commentBody += '\n\n';

        if (data.arcgisOnline.warnings.length > 0) {
          commentBody += '### ArcGIS Online Warnings\n\n';

          data.arcgisOnline.warnings.forEach((warning) => {
            commentBody += `- ${warning}\n`;
          });
        }
      }
    }
  }

  return commentBody;
}

export async function postIssueComment(
  validationResult: ValidationResult,
  options: {
    octokit?: Octokit | null;
    githubRepository?: string;
    issueNumber?: string;
  } = {},
): Promise<void> {
  const {
    octokit: providedOctokit = octokit,
    githubRepository: providedRepo = githubRepository,
    issueNumber: providedIssueNumber = issueNumber,
  } = options;

  if (!providedOctokit || !providedRepo || !providedIssueNumber) {
    log('ℹ️ Skipping GitHub comment - missing required GitHub context');

    return;
  }

  const [owner, repo] = providedRepo.split('/');
  if (!owner || !repo) {
    logError('❌ Invalid GitHub repository format:', providedRepo);

    return;
  }

  try {
    // Create a unique hidden marker for identifying our validation comments
    const botCommentMarker = `<!-- issue-ops-validation-comment -->`;

    // Check for existing validation comments
    const existingComments = await providedOctokit.rest.issues.listComments({
      owner,
      repo,
      issue_number: parseInt(providedIssueNumber, 10),
    });

    // Look for an existing validation comment from this script using the hidden marker
    // and ensure it was posted by the github-actions[bot] user
    const hasExistingComment = existingComments.data.find(
      (comment) =>
        comment.body &&
        comment.body.includes(botCommentMarker) &&
        comment.user &&
        (comment.user.login === 'github-actions[bot]' ||
          comment.user.type === 'Bot'),
    );

    const commentBody = generateCommentBody(validationResult);

    if (hasExistingComment) {
      // Update existing comment
      await providedOctokit.rest.issues.updateComment({
        owner,
        repo,
        comment_id: hasExistingComment.id,
        body: commentBody,
      });
      log(
        `✅ Updated existing validation comment on issue #${providedIssueNumber}`,
      );
    } else {
      // Create new comment
      await providedOctokit.rest.issues.createComment({
        owner,
        repo,
        issue_number: parseInt(providedIssueNumber, 10),
        body: commentBody,
      });
      log(`✅ Posted new validation comment on issue #${providedIssueNumber}`);
    }

    log(
      `✅ ${validationResult.success ? 'Success' : 'Failure'} feedback provided on issue #${providedIssueNumber}`,
    );
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error';
    logError('❌ Failed to post issue comment:', errorMessage);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  // file is being run directly, not imported
  run().catch((error: Error) => {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error';
    logError('Failed to process issue:', errorMessage);

    process.exit(1);
  });
}
