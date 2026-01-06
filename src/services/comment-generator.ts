import { markdownTable } from 'markdown-table';
import type { ValidationResult } from '../schema.js';
import { isValidationOk } from '../schema.js';

/**
 * Comment generator service
 * Generates formatted Markdown comments for GitHub issues
 */
export class CommentGenerator {
  /**
   * Generate validation comment body with results
   * @param validationResult - Validation result data
   * @returns Formatted Markdown comment
   */
  generateValidationComment(validationResult: ValidationResult): string {
    const validationMarker = `<!-- issue-ops-validation-comment -->`;

    // Determine the main status emoji
    const statusText = validationResult.success
      ? "Punch that ticket! This request's data is on track. 🎫 🚂🛤️"
      : "Whistle stop! ✋ This request's data isn't cleared for departure just yet.";
    const statusMessage = validationResult.success
      ? "The deprecation data has been successfully validated! Here's a summary of what I found."
      : 'There were validation errors found.';

    let commentBody = `${validationMarker}\n### ${statusText}\n\n${statusMessage}\n\n`;
    commentBody +=
      '**Please double check these results and edit your original issue until the results match your expectations and there are no errors.**\n\n';

    if (!isValidationOk(validationResult) && validationResult.errors) {
      commentBody += this.formatValidationErrors(validationResult);
    } else {
      commentBody += this.formatValidationSuccess(validationResult);
    }

    return commentBody;
  }

  /**
   * Format validation errors section
   */
  private formatValidationErrors(validationResult: ValidationResult): string {
    let errorSection = '### Input Validation Errors\n\n';

    // Top level errors
    if (validationResult.errors!.formErrors.length > 0) {
      validationResult.errors!.formErrors.forEach((error: string) => {
        errorSection += `- ${error}\n`;
      });
      errorSection += '\n';
    }

    // Handle field-specific errors
    Object.entries(validationResult.errors!.fieldErrors ?? {}).forEach(
      ([field, messages]) => {
        if (messages && Array.isArray(messages) && messages.length > 0) {
          messages.forEach((message: string) => {
            errorSection += `- **${field}**: ${message}\n`;
          });
        }
      },
    );

    return errorSection;
  }

  /**
   * Format validation success section with data tables
   */
  private formatValidationSuccess(validationResult: ValidationResult): string {
    let successSection = '';
    const data = validationResult.data;

    if (!data) {
      return successSection;
    }

    // Generate the SGID products table
    if (data.discovery.data.length > 0) {
      successSection += markdownTable(data.discovery.data, {
        alignDelimiters: false,
      });
      successSection += '\n\n';

      if (data.discovery.warnings?.length) {
        successSection += '> [!WARNING]\n';
        data.discovery.warnings.forEach((warning) => {
          successSection += `> - ${warning}\n`;
        });
        successSection += '\n';
      }
    }

    // ArcGIS Online section - only show if has data beyond header
    if (data.arcgisOnline.data.length > 1) {
      successSection += '### ArcGIS Online\n\n';
      successSection += markdownTable(data.arcgisOnline.data, {
        alignDelimiters: false,
      });
      successSection += '\n\n';

      if (data.arcgisOnline.warnings.length > 0) {
        successSection += '> [!WARNING]\n';
        data.arcgisOnline.warnings.forEach((warning) => {
          successSection += `> - ${warning}\n`;
        });
      }
    }

    return successSection;
  }

  /**
   * Generate stage progress comment (for future workflow use)
   * @param stageName - Name of the current stage
   * @param stageDescription - Description of what this stage does
   * @param progress - Progress indicator (e.g., "2 of 5 tasks complete")
   * @returns Formatted Markdown comment
   */
  generateStageComment(
    stageName: string,
    stageDescription: string,
    progress?: string,
  ): string {
    const marker = `<!-- issue-ops-stage: ${stageName} -->`;
    let comment = `${marker}\n## 🚂 Stage: ${stageName}\n\n`;
    comment += `${stageDescription}\n\n`;

    if (progress) {
      comment += `**Progress**: ${progress}\n\n`;
    }

    return comment;
  }

  /**
   * Generate workflow initialization comment (for future use)
   * @param workflowName - Human-readable workflow name
   * @param stages - Array of stage names
   * @returns Formatted Markdown comment
   */
  generateWorkflowInitComment(workflowName: string, stages: string[]): string {
    const marker = `<!-- issue-ops-workflow-init -->`;
    let comment = `${marker}\n## 🎫 ${workflowName} Workflow Started\n\n`;
    comment += `This issue will progress through the following stages:\n\n`;

    stages.forEach((stage, index) => {
      const emoji = index === 0 ? '▶️' : '⏸️';
      comment += `${index + 1}. ${emoji} ${stage}\n`;
    });

    comment +=
      '\n*The workflow will automatically update as tasks are completed.*\n';

    return comment;
  }
}

// Export singleton instance for backward compatibility
export const commentGenerator = new CommentGenerator();

// Export legacy function for backward compatibility
export function generateCommentBody(
  validationResult: ValidationResult,
): string {
  return commentGenerator.generateValidationComment(validationResult);
}
