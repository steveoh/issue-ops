import ky, { type KyResponse, type Options } from 'ky';
import { ExternalServiceError } from '../models/errors.js';

/**
 * HTTP client wrapper with retry logic and error handling
 * Wraps ky HTTP client for consistent error handling across the application
 */
export class HttpClient {
  private readonly defaultOptions: Options = {
    timeout: 30000, // 30 seconds
    retry: {
      limit: 3,
      methods: ['get', 'head'],
      statusCodes: [408, 413, 429, 500, 502, 503, 504],
    },
  };

  /**
   * Perform a HEAD request to check if a resource exists
   * @param url - URL to check
   * @param options - Additional ky options
   * @throws ExternalServiceError if request fails
   */
  async head(url: string, options?: Options): Promise<void> {
    try {
      await ky.head(url, {
        ...this.defaultOptions,
        ...options,
        redirect: 'error', // Don't follow redirects
      });
    } catch (error) {
      if (
        error instanceof Error &&
        error.cause &&
        typeof error.cause === 'object' &&
        'message' in error.cause &&
        error.cause.message === 'unexpected redirect'
      ) {
        throw new ExternalServiceError(
          'URL contains redirects - use final destination URL',
          'HTTP',
          'head',
          { url, reason: 'redirect' },
        );
      }

      if (
        error instanceof Error &&
        'response' in error &&
        error.response instanceof Response
      ) {
        const response = error.response as KyResponse;
        throw new ExternalServiceError(
          `HTTP ${response.status}: ${response.statusText}`,
          'HTTP',
          'head',
          { url, status: response.status, statusText: response.statusText },
        );
      }

      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      throw new ExternalServiceError(
        `Failed to HEAD ${url}: ${errorMessage}`,
        'HTTP',
        'head',
        { url, error: errorMessage },
      );
    }
  }

  /**
   * Perform a GET request
   * @param url - URL to fetch
   * @param options - Additional ky options
   * @returns Parsed JSON response
   * @throws ExternalServiceError if request fails
   */
  async get<T = unknown>(url: string, options?: Options): Promise<T> {
    try {
      const response = await ky.get(url, {
        ...this.defaultOptions,
        ...options,
      });

      return (await response.json()) as T;
    } catch (error) {
      if (
        error instanceof Error &&
        'response' in error &&
        error.response instanceof Response
      ) {
        const response = error.response as KyResponse;
        throw new ExternalServiceError(
          `HTTP ${response.status}: ${response.statusText}`,
          'HTTP',
          'get',
          { url, status: response.status, statusText: response.statusText },
        );
      }

      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      throw new ExternalServiceError(
        `Failed to GET ${url}: ${errorMessage}`,
        'HTTP',
        'get',
        { url, error: errorMessage },
      );
    }
  }

  /**
   * Perform a GET request and return the response object
   * Useful when you need to inspect headers or status
   * @param url - URL to fetch
   * @param options - Additional ky options
   * @returns Ky response object
   * @throws ExternalServiceError if request fails
   */
  async getRaw(url: string, options?: Options): Promise<KyResponse> {
    try {
      return await ky.get(url, {
        ...this.defaultOptions,
        ...options,
      });
    } catch (error) {
      if (
        error instanceof Error &&
        'response' in error &&
        error.response instanceof Response
      ) {
        const response = error.response as KyResponse;
        throw new ExternalServiceError(
          `HTTP ${response.status}: ${response.statusText}`,
          'HTTP',
          'getRaw',
          { url, status: response.status, statusText: response.statusText },
        );
      }

      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      throw new ExternalServiceError(
        `Failed to GET ${url}: ${errorMessage}`,
        'HTTP',
        'getRaw',
        { url, error: errorMessage },
      );
    }
  }
}

// Export singleton instance
export const httpClient = new HttpClient();
