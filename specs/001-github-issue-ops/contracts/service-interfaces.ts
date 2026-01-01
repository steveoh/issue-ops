/**
 * External Service Contracts
 * 
 * This file defines the interfaces for external service integrations.
 * These contracts abstract the underlying API clients and provide typed interfaces.
 */

/**
 * Base interface for all external services
 */
export interface ExternalService {
  /** Service name for logging and identification */
  name: string;
  
  /** Check if service is healthy and accessible */
  healthCheck(): Promise<boolean>;
  
  /** Execute operation with retry logic */
  withRetry<T>(operation: () => Promise<T>, options?: RetryOptions): Promise<T>;
}

/**
 * Retry configuration options
 */
export interface RetryOptions {
  /** Maximum number of retry attempts */
  maxRetries?: number;
  
  /** Initial delay in milliseconds */
  initialDelayMs?: number;
  
  /** Maximum delay in milliseconds */
  maxDelayMs?: number;
  
  /** Multiplier for exponential backoff */
  backoffMultiplier?: number;
  
  /** Whether to add jitter to delays */
  jitter?: boolean;
}

/**
 * GitHub API service interface
 */
export interface GitHubService extends ExternalService {
  /**
   * Create a new issue
   */
  createIssue(params: {
    owner: string;
    repo: string;
    title: string;
    body: string;
    assignees?: string[];
    labels?: string[];
  }): Promise<GitHubIssue>;
  
  /**
   * Get issue details
   */
  getIssue(params: {
    owner: string;
    repo: string;
    issueNumber: number;
  }): Promise<GitHubIssue>;
  
  /**
   * Update an issue
   */
  updateIssue(params: {
    owner: string;
    repo: string;
    issueNumber: number;
    title?: string;
    body?: string;
    state?: 'open' | 'closed';
    labels?: string[];
  }): Promise<GitHubIssue>;
  
  /**
   * Create a comment on an issue
   */
  createComment(params: {
    owner: string;
    repo: string;
    issueNumber: number;
    body: string;
  }): Promise<GitHubComment>;
  
  /**
   * Update an existing comment
   */
  updateComment(params: {
    owner: string;
    repo: string;
    commentId: number;
    body: string;
  }): Promise<GitHubComment>;
  
  /**
   * List comments on an issue
   */
  listComments(params: {
    owner: string;
    repo: string;
    issueNumber: number;
  }): Promise<GitHubComment[]>;
  
  /**
   * Add labels to an issue
   */
  addLabels(params: {
    owner: string;
    repo: string;
    issueNumber: number;
    labels: string[];
  }): Promise<void>;
  
  /**
   * Remove label from an issue
   */
  removeLabel(params: {
    owner: string;
    repo: string;
    issueNumber: number;
    label: string;
  }): Promise<void>;
}

export interface GitHubIssue {
  id: number;
  number: number;
  title: string;
  body: string | null;
  state: 'open' | 'closed';
  user: {
    login: string;
  };
  assignees: Array<{ login: string }>;
  labels: Array<{ name: string }>;
  created_at: string;
  updated_at: string;
  closed_at: string | null;
}

export interface GitHubComment {
  id: number;
  body: string;
  user: {
    login: string;
  };
  created_at: string;
  updated_at: string;
}

/**
 * ArcGIS service interface
 */
export interface ArcGISService extends ExternalService {
  /**
   * Verify a layer exists in the portal
   */
  verifyLayerExists(params: {
    layerId: string;
  }): Promise<boolean>;
  
  /**
   * Get layer metadata
   */
  getLayerMetadata(params: {
    layerId: string;
  }): Promise<ArcGISLayerMetadata>;
  
  /**
   * Search for layers by name
   */
  searchLayers(params: {
    query: string;
    maxResults?: number;
  }): Promise<ArcGISLayerMetadata[]>;
  
  /**
   * Check if user has permission to layer
   */
  checkPermission(params: {
    layerId: string;
    username: string;
  }): Promise<boolean>;
}

export interface ArcGISLayerMetadata {
  id: string;
  title: string;
  description: string;
  owner: string;
  created: string;
  modified: string;
  url: string;
  type: string;
  tags: string[];
}

/**
 * Google Sheets service interface
 */
export interface GoogleSheetsService extends ExternalService {
  /**
   * Get spreadsheet metadata
   */
  getSpreadsheet(params: {
    spreadsheetId: string;
  }): Promise<GoogleSpreadsheet>;
  
  /**
   * Read data from a sheet
   */
  readSheet(params: {
    spreadsheetId: string;
    sheetName: string;
    range?: string;
  }): Promise<string[][]>;
  
  /**
   * Write data to a sheet
   */
  writeSheet(params: {
    spreadsheetId: string;
    sheetName: string;
    range: string;
    values: string[][];
  }): Promise<void>;
  
  /**
   * Append rows to a sheet
   */
  appendRows(params: {
    spreadsheetId: string;
    sheetName: string;
    values: string[][];
  }): Promise<void>;
}

export interface GoogleSpreadsheet {
  id: string;
  title: string;
  sheets: Array<{
    title: string;
    index: number;
    rowCount: number;
    columnCount: number;
  }>;
}

/**
 * PostgreSQL service interface
 */
export interface PostgreSQLService extends ExternalService {
  /**
   * Execute a query
   */
  query<T = any>(params: {
    text: string;
    values?: any[];
  }): Promise<PostgreSQLResult<T>>;
  
  /**
   * Check if a table exists
   */
  tableExists(params: {
    tableName: string;
    schema?: string;
  }): Promise<boolean>;
  
  /**
   * Get table metadata
   */
  getTableMetadata(params: {
    tableName: string;
    schema?: string;
  }): Promise<PostgreSQLTableMetadata>;
}

export interface PostgreSQLResult<T = any> {
  rows: T[];
  rowCount: number;
  fields: Array<{
    name: string;
    dataTypeID: number;
  }>;
}

export interface PostgreSQLTableMetadata {
  schema: string;
  table: string;
  columns: Array<{
    name: string;
    type: string;
    nullable: boolean;
    default: string | null;
  }>;
  primaryKey: string[];
  indexes: Array<{
    name: string;
    columns: string[];
    unique: boolean;
  }>;
}

/**
 * Firestore service interface (optional persistence)
 */
export interface FirestoreService extends ExternalService {
  /**
   * Get a document
   */
  getDocument(params: {
    collection: string;
    documentId: string;
  }): Promise<FirestoreDocument | null>;
  
  /**
   * Set a document (create or update)
   */
  setDocument(params: {
    collection: string;
    documentId: string;
    data: any;
  }): Promise<void>;
  
  /**
   * Update a document
   */
  updateDocument(params: {
    collection: string;
    documentId: string;
    data: Partial<any>;
  }): Promise<void>;
  
  /**
   * Delete a document
   */
  deleteDocument(params: {
    collection: string;
    documentId: string;
  }): Promise<void>;
  
  /**
   * Query documents
   */
  queryDocuments(params: {
    collection: string;
    where?: Array<{
      field: string;
      operator: '==' | '!=' | '<' | '<=' | '>' | '>=' | 'in' | 'array-contains';
      value: any;
    }>;
    orderBy?: Array<{
      field: string;
      direction: 'asc' | 'desc';
    }>;
    limit?: number;
  }): Promise<FirestoreDocument[]>;
}

export interface FirestoreDocument {
  id: string;
  data: any;
  createTime: string;
  updateTime: string;
}

/**
 * HTTP client interface (for generic API calls)
 */
export interface HTTPClient {
  /**
   * Make a GET request
   */
  get<T = any>(url: string, options?: HTTPRequestOptions): Promise<HTTPResponse<T>>;
  
  /**
   * Make a POST request
   */
  post<T = any>(url: string, options?: HTTPRequestOptions): Promise<HTTPResponse<T>>;
  
  /**
   * Make a PUT request
   */
  put<T = any>(url: string, options?: HTTPRequestOptions): Promise<HTTPResponse<T>>;
  
  /**
   * Make a DELETE request
   */
  delete<T = any>(url: string, options?: HTTPRequestOptions): Promise<HTTPResponse<T>>;
}

export interface HTTPRequestOptions {
  headers?: Record<string, string>;
  json?: any;
  searchParams?: Record<string, string>;
  timeout?: number;
}

export interface HTTPResponse<T = any> {
  status: number;
  statusText: string;
  headers: Record<string, string>;
  data: T;
}
