import type { IGroup, IItemAdd } from '@esri/arcgis-rest-portal';
import ky, { type KyResponse } from 'ky';
import { z } from 'zod/v4';
import { pgTableExists } from './database.js';
import { validateSgidIndexId } from './sheets.js';
import { logError } from './utils.js';

type GroupResult = {
  other: IGroup[];
};

export type ValidationResult = {
  success: boolean;
  errors?: {
    formErrors: string[];
    fieldErrors: Record<string, string[] | undefined>;
  };
  data?: {
    displayName: string;
    discovery: {
      data: string[][];
      warnings: string[];
    };
    arcgisOnline: {
      data: string[][];
      warnings: string[];
    };
  };
};

export type IssueDataFields = z.input<typeof IssueDataSchema>;
export type IssueData = z.output<typeof IssueDataSchema> | undefined;

export const ISSUE_DATA_FIELDS = [
  'display-name',
  'internal-sgid-table',
  'open-sgid-table',
  'arcgis-online-id',
  'sgid-on-arcgis-url',
  'product-page-url',
  'sgid-index-id',
  'archives-record-series',
  'source',
  'historic-relevance',
];

export const IssueDataSchema = z
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
    source: z.array(z.string()).optional(),
    'archives-record-series': z.string().optional(),
    'historic-relevance': z.stringbool({
      truthy: ['Yes', 'yes'],
      falsy: ['No', 'no'],
    }),
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
          exists ? data['open-sgid-table'] : 'Not published',
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
          (error.response as KyResponse).status === 404
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
