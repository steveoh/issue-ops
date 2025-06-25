import { ISSUE_DATA_FIELDS, type IssueDataFields } from './schema.js';

export function parseIssueTemplate(lines: string[]): IssueDataFields {
  let result: IssueDataFields = {
    'display-name': '',
    'internal-sgid-table': '',
    'historic-relevance': '',
    'open-sgid-table': undefined,
    'arcgis-online-id': undefined,
    'sgid-on-arcgis-url': undefined,
    'product-page-url': undefined,
    'sgid-index-id': undefined,
    'archives-record-series': undefined,
    source: [],
  };

  let currentField: string | null = null;
  let otherSourceDetails: string | null = null;

  for (const line of lines) {
    // Look for field headers in the format "### Field Name"
    const headerMatch = line.match(/^###\s+(.+)$/);
    if (headerMatch) {
      currentField = headerMatch[1]!.toLowerCase().replace(/\s+/g, '-');

      continue;
    }

    // Handle checkbox items for source field
    if (currentField === 'source' && line.trim()) {
      const checkboxMatch = line.match(/^-\s+\[x\]\s+(.+)$/);
      if (checkboxMatch) {
        const value = checkboxMatch[1]!.trim();
        result.source!.push(value);
        continue;
      }
      // Skip unchecked boxes or invalid checkbox format
      if (line.match(/^-\s+\[\s*\]\s+/)) {
        continue;
      }
    }

    // Capture "Other Source Details" field value
    if (
      currentField === 'other-source-details' &&
      line.trim() &&
      !line.startsWith('_No response_')
    ) {
      otherSourceDetails = line.trim();
      currentField = null;
      continue;
    }

    // Look for filled-in values (non-empty lines that aren't placeholders)
    if (
      currentField &&
      ISSUE_DATA_FIELDS.includes(currentField) &&
      currentField !== 'source' && // source is handled above
      line.trim() &&
      !line.startsWith('_No response_') &&
      !line.startsWith('<!--') &&
      !line.includes('placeholder')
    ) {
      // Initialize a new object if data is undefined
      const obj = (result ?? {}) as Record<string, string | string[]>;
      obj[currentField] = line.trim();
      // Assign back to data
      result = obj as IssueDataFields;
      currentField = null;
    }
  }

  // Post-process: Replace "Other" with actual other source details if available
  if (result.source && otherSourceDetails) {
    const otherIndex = result.source.indexOf('Other');
    if (otherIndex !== -1) {
      result.source[otherIndex] = otherSourceDetails;
    }
  }

  return result;
}
