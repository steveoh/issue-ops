export const defaultLabels = [
  {
    name: 'status: validation failing',
    color: 'd73a4a',
    description: 'Issue has validation errors that need to be fixed',
  },
  {
    name: 'status: discovery failing',
    color: 'b71c1c',
    description: 'Issue has discovery errors that need to be fixed',
  },
  {
    name: 'status: waiting on actions',
    color: 'fbca04',
    description: 'Issue is waiting for automated actions to complete',
  },
  {
    name: 'status: waiting on reviews',
    color: '0075ca',
    description: 'Issue is waiting for review from team members',
  },
  {
    name: 'status: blocked',
    color: '000000',
    description: 'Issue is blocked and cannot proceed',
  },
  {
    name: 'status: paused',
    color: '7057ff',
    description: 'Issue work has been temporarily paused',
  },
  {
    name: 'status: soft delete',
    color: '8b4513',
    description: 'Issue is in 14 day soft delete state',
  },
  {
    name: 'status: soft delete review',
    color: '8b4513',
    description:
      'Soft delete action items are complete, issue is waiting for review from team members',
  },
  {
    name: 'type: full deprecation',
    color: 'f6c9a8',
    description: 'The dataset is being removed from the entire SGID',
  },
];
