export const QUEUE_NAME = 'carbonledger';

export const JobType = {
  CERTIFICATE_GENERATION: 'certificate_generation',
  IPFS_PINNING:           'ipfs_pinning',
  ORACLE_SUBMISSION:      'oracle_submission',
  EMAIL_NOTIFICATION:     'email_notification',
} as const;

export type JobType = typeof JobType[keyof typeof JobType];
