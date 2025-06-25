import type { Octokit } from '@octokit/rest';
import { defaultLabels } from './config.js';

export const log = (...args: unknown[]) => {
  if (process.env.NODE_ENV !== 'test') {
    console.log(...args);
  }
};
export const warn = (...args: unknown[]) => {
  if (process.env.NODE_ENV !== 'test') {
    console.warn(...args);
  }
};

export const logError = (...args: unknown[]) => {
  if (process.env.NODE_ENV !== 'test') {
    console.error(...args);
  }
};

export const createDefaultLabels = async (
  octokit: Octokit,
  githubRepository: string,
) => {
  if (!octokit || !githubRepository) {
    log('ℹ️ Skipping label update - missing required GitHub context');

    return;
  }
  const [owner, repo] = githubRepository.split('/');
  if (!owner || !repo) {
    logError('❌ Invalid GitHub repository format:', githubRepository);

    return;
  }

  try {
    const { data: existingLabels } =
      await octokit.rest.issues.listLabelsForRepo({
        owner,
        repo,
      });

    const existingLabelNames = new Set(
      existingLabels.map((label) => label.name),
    );
    const labelsToCreate = defaultLabels.filter(
      (label) => !existingLabelNames.has(label.name),
    );

    log(
      `🔍 Found ${existingLabels.length} existing labels, ${labelsToCreate.length} labels to create`,
    );

    for (const label of labelsToCreate) {
      try {
        await octokit.rest.issues.createLabel({
          owner,
          repo,
          name: label.name,
          color: label.color,
          description: label.description,
        });
      } catch (error) {
        if (
          error instanceof Error &&
          !error.message.includes('already_exists')
        ) {
          logError(`Failed to create label '${label.name}':`, error.message);
        }
      }
    }
  } catch (error) {
    logError('Error creating default labels:', error);
  }
};
