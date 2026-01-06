import { WorkflowType } from '../models/types.js';

/**
 * Template detector service
 * Detects which workflow type an issue belongs to based on labels and body
 */
export class TemplateDetector {
  /**
   * Detect workflow type from issue labels and body
   * @param labels - Array of label names
   * @param body - Issue body text
   * @returns Workflow type if detected, null otherwise
   */
  detect(labels: string[], body: string): WorkflowType | null {
    // Check for SGID deprecation workflow
    if (this.isSgidDeprecation(labels, body)) {
      return WorkflowType.SGID_DEPRECATION;
    }

    // Future: Add more workflow types
    // if (this.isSgidAddition(labels, body)) {
    //   return WorkflowType.SGID_ADDITION;
    // }
    // if (this.isAppAddition(labels, body)) {
    //   return WorkflowType.APP_ADDITION;
    // }

    return null;
  }

  /**
   * Check if issue is an SGID deprecation request
   */
  private isSgidDeprecation(labels: string[], body: string): boolean {
    // Check for specific type labels
    const hasDeprecationType = labels.some((label) =>
      [
        'type: full deprecation',
        'type: internal/open sgid deprecation',
        'type: full circle deprecation',
      ].includes(label.toLowerCase()),
    );

    // Check for workflow label
    const hasWorkflowLabel = labels.some((label) =>
      label.toLowerCase().includes('sgid-deprecation'),
    );

    // Check for general deprecation label
    const hasDeprecationLabel = labels.some((label) =>
      label.toLowerCase().includes('deprecation'),
    );

    // Check body contains deprecation keywords
    const bodyLower = body.toLowerCase();
    const hasDeprecationKeywords =
      bodyLower.includes('deprecat') ||
      bodyLower.includes('remov') ||
      bodyLower.includes('delet');

    // Priority order:
    // 1. Workflow label (most specific)
    // 2. Type label (specific deprecation types)
    // 3. Generic deprecation label + keywords
    return (
      hasWorkflowLabel ||
      hasDeprecationType ||
      (hasDeprecationLabel && hasDeprecationKeywords)
    );
  }

  /**
   * Future: Check if issue is an SGID addition request
   */
  private isSgidAddition(labels: string[], _body: string): boolean {
    return labels.some((label) => label.toLowerCase().includes('addition'));
  }

  /**
   * Future: Check if issue is an application addition request
   */
  private isAppAddition(labels: string[], body: string): boolean {
    const bodyLower = body.toLowerCase();
    return (
      labels.some((label) => label.toLowerCase().includes('application')) &&
      (bodyLower.includes('app') ||
        bodyLower.includes('application') ||
        bodyLower.includes('servicenow'))
    );
  }
}

// Export singleton instance
export const templateDetector = new TemplateDetector();
