import { Client } from 'pg';
import { ExternalServiceError } from '../models/errors.js';

/**
 * PostgreSQL service for Open SGID database operations
 * Provides access to the Open SGID database for validation and discovery
 */
export class PostgresService {
  private connectionConfig = {
    user: process.env.OPEN_SGID_PASSWORD,
    password: process.env.OPEN_SGID_PASSWORD,
    host: 'opensgid.agrc.utah.gov',
    database: 'opensgid',
    port: 5432,
  };

  /**
   * Check if a table exists in the Open SGID database
   * @param schema - Database schema name (e.g., 'transportation')
   * @param table - Table name (e.g., 'roads')
   * @returns True if table exists, false otherwise
   * @throws ExternalServiceError if database connection fails
   */
  async tableExists(schema: string, table: string): Promise<boolean> {
    const client = new Client(this.connectionConfig);

    // Connect first - connection errors will throw
    await client.connect();

    try {
      const response = await client.query(
        `
        select exists (
          select 1
          from information_schema.tables
          where table_schema = $1::text
          and table_name = $2::text
        );
      `,
        [schema, table],
      );

      return response.rows[0]?.exists ?? false;
    } catch {
      // Query errors return false (table might not exist)
      return false;
    } finally {
      await client.end();
    }
  }

  /**
   * Execute a custom query against Open SGID
   * @param query - SQL query string
   * @param params - Query parameters
   * @returns Query results
   * @throws ExternalServiceError if query fails
   */
  async query<T = unknown>(
    query: string,
    params: unknown[] = [],
  ): Promise<T[]> {
    const client = new Client(this.connectionConfig);

    try {
      await client.connect();

      const response = await client.query(query, params);

      return response.rows as T[];
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';

      throw new ExternalServiceError(
        `Failed to execute query: ${errorMessage}`,
        'PostgreSQL',
        'query',
        { query, params, error: errorMessage },
      );
    } finally {
      await client.end();
    }
  }

  /**
   * Get metadata about a table
   * @param schema - Database schema name
   * @param table - Table name
   * @returns Table metadata including column info
   * @throws ExternalServiceError if query fails
   */
  async getTableMetadata(
    schema: string,
    table: string,
  ): Promise<{ column_name: string; data_type: string }[]> {
    return this.query<{ column_name: string; data_type: string }>(
      `
      select column_name, data_type
      from information_schema.columns
      where table_schema = $1::text
      and table_name = $2::text
      order by ordinal_position;
    `,
      [schema, table],
    );
  }
}

// Export singleton instance for backward compatibility
export const postgresService = new PostgresService();

// Export legacy function for backward compatibility
// Note: This re-throws connection errors to maintain existing behavior
export async function pgTableExists(
  schema: string,
  table: string,
): Promise<boolean> {
  return await postgresService.tableExists(schema, table);
}
