import type { AxiosInstance } from 'axios';
import axiosRetry from 'axios-retry';
import {
  auth,
  type AuthClient,
  type BaseExternalAccountClient,
  GoogleAuth,
  type Impersonated,
  type JWT,
  type UserRefreshClient,
} from 'google-auth-library';
import {
  GoogleSpreadsheet,
  type GoogleSpreadsheetRow,
} from 'google-spreadsheet';
import { randomInt } from 'node:crypto';
import { ExternalServiceError } from '../models/errors.js';

// Define JSONClient locally since it's not exported from the main module
type JSONClient =
  | JWT
  | UserRefreshClient
  | BaseExternalAccountClient
  | Impersonated;

type RowData = {
  id: string;
  rowNumber?: number;
};

/**
 * Google Sheets service for SGID Index operations
 * Provides access to the SGID Index spreadsheet for validation
 */
export class SheetsService {
  private readonly spreadsheetId =
    '11ASS7LnxgpnD0jN4utzklREgMf1pcvYjcXcIcESHweQ';
  private readonly scopes = [
    'https://www.googleapis.com/auth/spreadsheets',
    'https://www.googleapis.com/auth/drive',
  ];
  private cachedRows?: GoogleSpreadsheetRow<RowData>[];

  /**
   * Configure retry logic for API clients
   * Handles rate limiting with exponential backoff
   */
  private configureRetry(client: AxiosInstance): void {
    axiosRetry(client, {
      retries: 7,
      retryDelay: (retryCount) => {
        const randomNumberMS = randomInt(1000, 8001);

        return Math.min(4 ** retryCount + randomNumberMS, 20000);
      },
      retryCondition: (error) => error.response?.status === 429,
    });
  }

  /**
   * Initialize Google Auth client based on environment
   * Uses service account in CI, ADC locally
   */
  private async getAuthClient(): Promise<GoogleAuth<AuthClient> | JSONClient> {
    if (process.env.GITHUB_ACTIONS) {
      if (!process.env.GOOGLE_PRIVATE_KEY) {
        throw new ExternalServiceError(
          'GOOGLE_PRIVATE_KEY environment variable not set',
          'GoogleSheets',
          'getAuthClient',
        );
      }

      const client = auth.fromJSON(
        JSON.parse(process.env.GOOGLE_PRIVATE_KEY),
      ) as JSONClient;

      if ('scopes' in client) {
        client.scopes = this.scopes;
      }

      return client;
    } else {
      return new GoogleAuth({ scopes: this.scopes });
    }
  }

  /**
   * Load worksheet data with caching
   * @returns All rows from SGID Index worksheet
   * @throws ExternalServiceError if worksheet cannot be loaded
   */
  private async getWorksheetData(): Promise<GoogleSpreadsheetRow<RowData>[]> {
    if (this.cachedRows) {
      return this.cachedRows;
    }

    try {
      const client = await this.getAuthClient();
      const spreadsheet = new GoogleSpreadsheet(this.spreadsheetId, client);

      this.configureRetry(spreadsheet.sheetsApi);
      this.configureRetry(spreadsheet.driveApi);

      await spreadsheet.loadInfo();

      const worksheet = spreadsheet.sheetsByTitle['SGID Index'];
      if (!worksheet) {
        throw new ExternalServiceError(
          'SGID Index worksheet not found',
          'GoogleSheets',
          'getWorksheetData',
          { spreadsheetId: this.spreadsheetId },
        );
      }

      const rows = await worksheet.getRows<RowData>();
      this.cachedRows = rows;

      return rows;
    } catch (error) {
      if (error instanceof ExternalServiceError) {
        throw error;
      }

      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';

      throw new ExternalServiceError(
        `Failed to load SGID Index: ${errorMessage}`,
        'GoogleSheets',
        'getWorksheetData',
        { spreadsheetId: this.spreadsheetId, error: errorMessage },
      );
    }
  }

  /**
   * Validate an SGID Index ID exists in the spreadsheet
   * @param id - UUID to validate
   * @returns Row number if found, -1 if not found
   * @throws ExternalServiceError if sheet cannot be accessed
   */
  async validateSgidIndexId(id: string): Promise<number> {
    const rows = await this.getWorksheetData();
    const row = rows.find((row) => row.get('id') === id);

    if (!row) {
      return -1;
    }

    return row.rowNumber ?? -1;
  }

  /**
   * Clear cached rows (useful for testing or forcing refresh)
   */
  clearCache(): void {
    this.cachedRows = undefined;
  }

  /**
   * Get all rows from SGID Index (with caching)
   * @returns All worksheet rows
   */
  async getAllRows(): Promise<GoogleSpreadsheetRow<RowData>[]> {
    return this.getWorksheetData();
  }
}

// Export singleton instance for backward compatibility
export const sheetsService = new SheetsService();

// Export legacy function for backward compatibility
export async function validateSgidIndexId(id: string): Promise<number> {
  return sheetsService.validateSgidIndexId(id);
}
