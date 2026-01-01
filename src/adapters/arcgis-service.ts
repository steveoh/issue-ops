import type { IGroup, IItem } from '@esri/arcgis-rest-portal';
import { ExternalServiceError } from '../models/errors.js';
import { httpClient } from './http-client.js';

/**
 * ArcGIS Online item details
 */
export interface ArcGISItemDetails {
  id: string;
  access: string;
  title?: string;
  type?: string;
}

/**
 * ArcGIS Online service for item verification and metadata
 * Provides access to ArcGIS Online REST API for validation
 */
export class ArcGISService {
  private readonly baseUrl = 'https://www.arcgis.com/sharing/rest';

  /**
   * Get ArcGIS Online item details
   * @param itemId - ArcGIS Online item ID (32-char hex)
   * @returns Item details including sharing status
   * @throws ExternalServiceError if item cannot be fetched
   */
  async getItemDetails(itemId: string): Promise<ArcGISItemDetails> {
    try {
      const url = `${this.baseUrl}/content/items/${itemId}`;
      const response = await httpClient.get<IItem>(url, {
        searchParams: { f: 'json' },
        redirect: 'error',
      });

      if (!response || !response.id) {
        throw new ExternalServiceError(
          'Invalid ArcGIS Online item data',
          'ArcGIS',
          'getItemDetails',
          { itemId },
        );
      }

      return {
        id: response.id,
        access: response.access || 'unknown',
        title: response.title,
        type: response.type,
      };
    } catch (error) {
      if (error instanceof ExternalServiceError) {
        throw error;
      }

      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';

      throw new ExternalServiceError(
        `Failed to fetch ArcGIS Online item: ${errorMessage}`,
        'ArcGIS',
        'getItemDetails',
        { itemId, error: errorMessage },
      );
    }
  }

  /**
   * Get groups an item belongs to
   * @param itemId - ArcGIS Online item ID
   * @returns List of group titles (filtered to UtahAGRC owner)
   * @throws ExternalServiceError if groups cannot be fetched
   */
  async getItemGroups(itemId: string): Promise<string[]> {
    try {
      const url = `${this.baseUrl}/content/items/${itemId}/groups`;
      const response = await httpClient.get<{ other?: IGroup[] }>(url, {
        searchParams: { f: 'json' },
        redirect: 'error',
      });

      if (!response || !response.other) {
        throw new ExternalServiceError(
          'Invalid ArcGIS Online item groups data',
          'ArcGIS',
          'getItemGroups',
          { itemId },
        );
      }

      // Filter to UtahAGRC owned groups and extract titles
      return response.other
        .filter((group) => group.owner === 'UtahAGRC')
        .map((group) => group.title)
        .filter((title): title is string => !!title);
    } catch (error) {
      if (error instanceof ExternalServiceError) {
        throw error;
      }

      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';

      throw new ExternalServiceError(
        `Failed to fetch ArcGIS Online item groups: ${errorMessage}`,
        'ArcGIS',
        'getItemGroups',
        { itemId, error: errorMessage },
      );
    }
  }

  /**
   * Check if an item is publicly shared
   * @param itemId - ArcGIS Online item ID
   * @returns True if item access is 'public'
   */
  async isItemPublic(itemId: string): Promise<boolean> {
    const details = await this.getItemDetails(itemId);
    return details.access === 'public';
  }

  /**
   * Get full item URL
   * @param itemId - ArcGIS Online item ID
   * @returns Full URL to item page
   */
  getItemUrl(itemId: string): string {
    return `https://www.arcgis.com/home/item.html?id=${itemId}`;
  }

  /**
   * Validate item exists and get summary for display
   * @param itemId - ArcGIS Online item ID
   * @returns Validation summary with status
   */
  async validateItem(itemId: string): Promise<{
    exists: boolean;
    isPublic: boolean;
    groups: string[];
    url: string;
    error?: string;
  }> {
    try {
      const [details, groups] = await Promise.all([
        this.getItemDetails(itemId),
        this.getItemGroups(itemId),
      ]);

      return {
        exists: true,
        isPublic: details.access === 'public',
        groups,
        url: this.getItemUrl(itemId),
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';

      return {
        exists: false,
        isPublic: false,
        groups: [],
        url: this.getItemUrl(itemId),
        error: errorMessage,
      };
    }
  }
}

// Export singleton instance
export const arcgisService = new ArcGISService();
